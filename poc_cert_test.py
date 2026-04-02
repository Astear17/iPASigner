#!/usr/bin/env python3
"""
POC test for iOS Certificate Tool:
1. Generate a self-signed certificate + P12 to simulate a real scenario
2. Test P12 parsing (extract cert info)
3. Test mobileprovision parsing (simulate a plist blob)
4. Test P12 password change
5. Test zip extraction of p12 + mobileprovision
"""

import os
import sys
import json
import zipfile
import io
import plistlib
import traceback
from datetime import datetime, timezone, timedelta

# ── 1. Generate test P12 ──────────────────────────────────────────────────────
def generate_test_p12(password: bytes) -> bytes:
    """Generate a self-signed PKCS12 for testing."""
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.serialization import pkcs12

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.USER_ID,          "Q6SJUT5K5D"),
        x509.NameAttribute(NameOID.COMMON_NAME,      "iPhone Distribution: XL AXIATA, PT TBK"),
        x509.NameAttribute(NameOID.COUNTRY_NAME,     "ID"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME,"XL AXIATA, PT TBK"),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "Q6SJUT5K5D"),
    ])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + timedelta(days=1095))  # 3 years
        .sign(key, hashes.SHA256())
    )
    p12_bytes = pkcs12.serialize_key_and_certificates(
        name=b"test",
        key=key,
        cert=cert,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(password)
    )
    return p12_bytes


# ── 2. Test P12 parsing ───────────────────────────────────────────────────────
def test_parse_p12(p12_bytes: bytes, password: str) -> dict:
    from cryptography.hazmat.primitives.serialization.pkcs12 import load_pkcs12
    from cryptography.x509.oid import NameOID

    pw = password.encode() if isinstance(password, str) else password
    try:
        p12 = load_pkcs12(p12_bytes, pw)
    except Exception as e:
        err = str(e).lower()
        if any(k in err for k in ["mac verify", "pkcs12", "decrypt", "password", "bad decrypt"]):
            return {"error": "wrong_password", "message": f"Wrong certificate password: {e}"}
        return {"error": "invalid_p12", "message": str(e)}

    cert = p12.cert.certificate if p12.cert else None
    if not cert:
        return {"error": "no_cert", "message": "No certificate in P12 file"}

    def get_attr(name, oid):
        try:
            return name.get_attributes_for_oid(oid)[0].value
        except Exception:
            return None

    subject = cert.subject
    from cryptography.x509.oid import NameOID as OID
    result = {
        "user_id":     get_attr(subject, OID.USER_ID) or get_attr(subject, OID.ORGANIZATIONAL_UNIT_NAME),
        "common_name": get_attr(subject, OID.COMMON_NAME),
        "country":     get_attr(subject, OID.COUNTRY_NAME),
        "organization":get_attr(subject, OID.ORGANIZATION_NAME),
        "org_unit":    get_attr(subject, OID.ORGANIZATIONAL_UNIT_NAME),
        "not_before":  cert.not_valid_before_utc.strftime("%Y-%m-%d %H:%M"),
        "not_after":   cert.not_valid_after_utc.strftime("%Y-%m-%d %H:%M"),
        "source":      "Apple Developer" if "iPhone" in (get_attr(subject, OID.COMMON_NAME) or "") else "Other",
    }
    return result


# ── 3. Test mobileprovision parsing ──────────────────────────────────────────
def generate_test_mobileprovision() -> bytes:
    """
    A real .mobileprovision is a CMS-signed plist.
    For testing purposes, we simulate the raw plist extraction that openssl would do.
    In production, we strip the CMS wrapper bytes to get to the plist.
    Here we create a raw plist (not CMS-wrapped) to test the parsing logic.
    """
    entitlements = {
        "application-identifier": "Q6SJUT5K5D.com.xl.MyXL.Giant",
        "aps-environment": "production",
        "com.apple.developer.associated-domains": ["*"],
        "com.apple.developer.team-identifier": "Q6SJUT5K5D",
        "application-groups": [],
        "get-task-allow": False,
        "keychain-access-groups": ["Q6SJUT5K5D.*", "com.apple.token"],
    }
    profile = {
        "Name":             "MyXL-UniversalDist",
        "UUID":             "com.xl.MyXL.Giant-staging",
        "TeamIdentifier":   ["Q6SJUT5K5D"],
        "CreationDate":     datetime(2026, 2, 19, 12, 9, tzinfo=timezone.utc),
        "ExpirationDate":   datetime(2027, 2, 19, 12, 9, tzinfo=timezone.utc),
        "Entitlements":     entitlements,
        "TeamName":         "XL AXIATA, PT TBK",
        "ProvisionsAllDevices": False,
    }
    return plistlib.dumps(profile, fmt=plistlib.FMT_XML)


def parse_mobileprovision_bytes(mp_bytes: bytes) -> dict:
    """
    Try to parse mobileprovision plist.
    Real .mobileprovision files are CMS-wrapped. We need to extract the embedded plist.
    Strategy: scan for <?xml or bplist marker inside the binary blob.
    """
    # Try direct plist parse first (for test plist without CMS wrapper)
    try:
        return _parse_plist_data(mp_bytes)
    except Exception:
        pass

    # Try to find the embedded plist in CMS-signed data
    # XML plist starts with '<?xml' or '<plist'
    xml_start = mp_bytes.find(b'<?xml')
    if xml_start == -1:
        xml_start = mp_bytes.find(b'<plist')
    xml_end = mp_bytes.rfind(b'</plist>')
    if xml_start != -1 and xml_end != -1:
        plist_data = mp_bytes[xml_start:xml_end + 8]
        try:
            return _parse_plist_data(plist_data)
        except Exception as e:
            pass

    # Try binary plist
    bplist_start = mp_bytes.find(b'bplist')
    if bplist_start != -1:
        try:
            return _parse_plist_data(mp_bytes[bplist_start:])
        except Exception:
            pass

    return {"error": "invalid_mobileprovision", "message": "Could not parse mobileprovision file"}


def _parse_plist_data(data: bytes) -> dict:
    plist = plistlib.loads(data)
    entitlements = plist.get("Entitlements", {})
    team_ids = plist.get("TeamIdentifier", [])

    def fmt_date(d):
        if d is None:
            return None
        if isinstance(d, datetime):
            return d.strftime("%Y-%m-%d %H:%M")
        return str(d)

    def expand_entitlement(val):
        if isinstance(val, list):
            if len(val) == 0:
                return "(empty)"
            if len(val) == 1:
                return val[0]
            return {"count": len(val), "values": val}
        return val

    return {
        "name":             plist.get("Name", ""),
        "uuid":             plist.get("UUID", ""),
        "team_identifier":  team_ids[0] if team_ids else "",
        "team_name":        plist.get("TeamName", ""),
        "created_at":       fmt_date(plist.get("CreationDate")),
        "expires_at":       fmt_date(plist.get("ExpirationDate")),
        "entitlements": {
            "application_identifier":  expand_entitlement(entitlements.get("application-identifier", "")),
            "aps_environment":         expand_entitlement(entitlements.get("aps-environment", "")),
            "associated_domains":      expand_entitlement(entitlements.get("com.apple.developer.associated-domains", "(empty)")),
            "team_identifier":         expand_entitlement(entitlements.get("com.apple.developer.team-identifier", "")),
            "application_groups":      expand_entitlement(entitlements.get("application-groups", [])),
            "get_task_allow":          entitlements.get("get-task-allow", False),
            "keychain_access_groups":  expand_entitlement(entitlements.get("keychain-access-groups", [])),
        }
    }


# ── 4. Test password change ───────────────────────────────────────────────────
def test_change_p12_password(p12_bytes: bytes, old_password: str, new_password: str) -> bytes:
    from cryptography.hazmat.primitives.serialization.pkcs12 import load_pkcs12, serialize_key_and_certificates
    from cryptography.hazmat.primitives import serialization

    old_pw = old_password.encode() if isinstance(old_password, str) else old_password
    new_pw = new_password.encode() if isinstance(new_password, str) else new_password

    try:
        p12 = load_pkcs12(p12_bytes, old_pw)
    except Exception as e:
        err = str(e).lower()
        if any(k in err for k in ["mac verify", "pkcs12", "decrypt", "password", "bad decrypt"]):
            raise ValueError(f"wrong_password: {e}")
        raise ValueError(f"invalid_p12: {e}")

    new_p12_bytes = serialize_key_and_certificates(
        name=p12.cert.friendly_name if p12.cert else b"cert",
        key=p12.key,
        cert=p12.cert.certificate if p12.cert else None,
        cas=[ca.certificate for ca in (p12.additional_certs or [])],
        encryption_algorithm=serialization.BestAvailableEncryption(new_pw)
    )
    return new_p12_bytes


# ── 5. Test zip extraction ────────────────────────────────────────────────────
def test_zip_extraction(p12_bytes: bytes, mp_bytes: bytes) -> tuple:
    """Create a test zip then extract p12 + mobileprovision from it."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("cert.p12", p12_bytes)
        zf.writestr("profile.mobileprovision", mp_bytes)
        zf.writestr("some_readme.txt", "This is a test zip")
    buf.seek(0)
    zip_bytes = buf.read()

    # Extract
    extracted_p12 = None
    extracted_mp = None
    with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
        for name in zf.namelist():
            lower = name.lower()
            if lower.endswith('.p12') and extracted_p12 is None:
                extracted_p12 = zf.read(name)
            elif lower.endswith('.mobileprovision') and extracted_mp is None:
                extracted_mp = zf.read(name)

    assert extracted_p12 is not None, "P12 not found in zip"
    assert extracted_mp is not None, "Mobileprovision not found in zip"
    assert extracted_p12 == p12_bytes, "P12 mismatch"
    assert extracted_mp == mp_bytes, "Mobileprovision mismatch"
    return extracted_p12, extracted_mp


# ── 6. Test create output zip ─────────────────────────────────────────────────
def test_create_output_zip(p12_bytes: bytes, mp_bytes: bytes, new_password: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("cert.p12", p12_bytes)
        zf.writestr("cert.mobileprovision", mp_bytes)
        zf.writestr("password.txt", new_password)
    buf.seek(0)
    return buf.read()


# ── Main test runner ──────────────────────────────────────────────────────────
def run_all_tests():
    results = {}
    old_pass = "TestPassword123!"
    new_pass = "NewPassword456!"

    print("\n" + "="*60)
    print("iOS SignTool - Certificate Tools POC Test")
    print("="*60)

    # Test 1: Generate test P12
    print("\n[1] Generating test P12 certificate...")
    try:
        p12_bytes = generate_test_p12(old_pass.encode())
        mp_bytes = generate_test_mobileprovision()
        print(f"    ✓ P12 generated: {len(p12_bytes)} bytes")
        print(f"    ✓ Mobileprovision generated: {len(mp_bytes)} bytes")
        results["generate"] = "PASS"
    except Exception as e:
        print(f"    ✗ FAILED: {e}")
        traceback.print_exc()
        results["generate"] = f"FAIL: {e}"
        return results

    # Test 2: Parse P12 with correct password
    print("\n[2] Testing P12 parsing (correct password)...")
    try:
        cert_info = test_parse_p12(p12_bytes, old_pass)
        assert "error" not in cert_info, f"Error returned: {cert_info}"
        print(f"    ✓ Common Name: {cert_info['common_name']}")
        print(f"    ✓ User ID: {cert_info['user_id']}")
        print(f"    ✓ Country: {cert_info['country']}")
        print(f"    ✓ Organization: {cert_info['organization']}")
        print(f"    ✓ Org Unit: {cert_info['org_unit']}")
        print(f"    ✓ Not Before: {cert_info['not_before']}")
        print(f"    ✓ Not After: {cert_info['not_after']}")
        results["parse_p12_correct"] = "PASS"
    except Exception as e:
        print(f"    ✗ FAILED: {e}")
        traceback.print_exc()
        results["parse_p12_correct"] = f"FAIL: {e}"

    # Test 3: Parse P12 with wrong password
    print("\n[3] Testing P12 parsing (wrong password)...")
    try:
        cert_info = test_parse_p12(p12_bytes, "WrongPassword!")
        if "error" in cert_info and cert_info["error"] == "wrong_password":
            print(f"    ✓ Wrong password correctly detected: {cert_info['message'][:60]}")
            results["parse_p12_wrong_pw"] = "PASS"
        else:
            print(f"    ✗ Expected wrong_password error but got: {cert_info}")
            results["parse_p12_wrong_pw"] = "FAIL: no error returned"
    except Exception as e:
        print(f"    ✗ FAILED: {e}")
        results["parse_p12_wrong_pw"] = f"FAIL: {e}"

    # Test 4: Parse mobileprovision
    print("\n[4] Testing mobileprovision parsing...")
    try:
        profile_info = parse_mobileprovision_bytes(mp_bytes)
        assert "error" not in profile_info, f"Error: {profile_info}"
        print(f"    ✓ Name: {profile_info['name']}")
        print(f"    ✓ UUID: {profile_info['uuid']}")
        print(f"    ✓ Team ID: {profile_info['team_identifier']}")
        print(f"    ✓ Created At: {profile_info['created_at']}")
        print(f"    ✓ Expires At: {profile_info['expires_at']}")
        ent = profile_info['entitlements']
        print(f"    ✓ App Identifier: {ent['application_identifier']}")
        print(f"    ✓ APS Environment: {ent['aps_environment']}")
        print(f"    ✓ Get Task Allow: {ent['get_task_allow']}")
        results["parse_mp"] = "PASS"
    except Exception as e:
        print(f"    ✗ FAILED: {e}")
        traceback.print_exc()
        results["parse_mp"] = f"FAIL: {e}"

    # Test 5: Change P12 password
    print("\n[5] Testing P12 password change...")
    try:
        new_p12_bytes = test_change_p12_password(p12_bytes, old_pass, new_pass)
        print(f"    ✓ New P12 generated: {len(new_p12_bytes)} bytes")
        # Verify new password works
        cert_info_new = test_parse_p12(new_p12_bytes, new_pass)
        assert "error" not in cert_info_new, f"New password fails: {cert_info_new}"
        print(f"    ✓ New password works: {cert_info_new['common_name']}")
        # Verify old password fails
        cert_info_old = test_parse_p12(new_p12_bytes, old_pass)
        assert cert_info_old.get("error") == "wrong_password", f"Old password should fail but got: {cert_info_old}"
        print(f"    ✓ Old password correctly rejected")
        results["change_password"] = "PASS"
    except Exception as e:
        print(f"    ✗ FAILED: {e}")
        traceback.print_exc()
        results["change_password"] = f"FAIL: {e}"

    # Test 6: Zip extraction
    print("\n[6] Testing zip extraction...")
    try:
        extracted_p12, extracted_mp = test_zip_extraction(p12_bytes, mp_bytes)
        print(f"    ✓ P12 extracted from zip: {len(extracted_p12)} bytes")
        print(f"    ✓ Mobileprovision extracted from zip: {len(extracted_mp)} bytes")
        results["zip_extraction"] = "PASS"
    except Exception as e:
        print(f"    ✗ FAILED: {e}")
        traceback.print_exc()
        results["zip_extraction"] = f"FAIL: {e}"

    # Test 7: Create output zip
    print("\n[7] Testing output zip creation...")
    try:
        new_p12_bytes = test_change_p12_password(p12_bytes, old_pass, new_pass)
        output_zip = test_create_output_zip(new_p12_bytes, mp_bytes, new_pass)
        # Verify zip contents
        with zipfile.ZipFile(io.BytesIO(output_zip), 'r') as zf:
            names = zf.namelist()
            assert "cert.p12" in names, f"cert.p12 missing from output zip. Found: {names}"
            assert "cert.mobileprovision" in names, f"cert.mobileprovision missing"
            assert "password.txt" in names, f"password.txt missing"
            pw_content = zf.read("password.txt").decode()
            assert pw_content == new_pass, f"Password mismatch: {pw_content}"
        print(f"    ✓ Output zip: {len(output_zip)} bytes, contains: {names}")
        results["output_zip"] = "PASS"
    except Exception as e:
        print(f"    ✗ FAILED: {e}")
        traceback.print_exc()
        results["output_zip"] = f"FAIL: {e}"

    # Test 8: Wrong old password on change
    print("\n[8] Testing password change with wrong old password...")
    try:
        try:
            test_change_p12_password(p12_bytes, "WrongOldPass!", new_pass)
            print(f"    ✗ FAILED: should have raised ValueError")
            results["change_password_wrong_old"] = "FAIL: no error raised"
        except ValueError as e:
            if "wrong_password" in str(e):
                print(f"    ✓ Wrong old password correctly detected: {str(e)[:60]}")
                results["change_password_wrong_old"] = "PASS"
            else:
                print(f"    ✗ FAILED: wrong error type: {e}")
                results["change_password_wrong_old"] = f"FAIL: {e}"
    except Exception as e:
        print(f"    ✗ FAILED: {e}")
        results["change_password_wrong_old"] = f"FAIL: {e}"

    # Summary
    print("\n" + "="*60)
    print("POC TEST SUMMARY")
    print("="*60)
    all_pass = True
    for test, result in results.items():
        status = "✓ PASS" if result == "PASS" else f"✗ {result}"
        print(f"  {test:35s}: {status}")
        if result != "PASS":
            all_pass = False

    print("="*60)
    print(f"\nOverall: {'ALL TESTS PASSED ✓' if all_pass else 'SOME TESTS FAILED ✗'}")
    return results, all_pass


if __name__ == "__main__":
    results, all_pass = run_all_tests()
    sys.exit(0 if all_pass else 1)
