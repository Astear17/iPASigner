"""Certificate tools for iOS SignTool.
Handles P12 parsing, mobileprovision parsing, and P12 password changing.
"""
import io
import plistlib
import zipfile
from datetime import datetime, timezone
from typing import Optional, Tuple


def _get_attr(name, oid):
    """Safely get a certificate attribute."""
    try:
        return name.get_attributes_for_oid(oid)[0].value
    except Exception:
        return None


def load_pkcs12_info(p12_bytes: bytes, password: str) -> dict:
    """Parse P12 certificate and extract metadata."""
    from cryptography.hazmat.primitives.serialization.pkcs12 import load_pkcs12
    from cryptography.x509.oid import NameOID

    pw = password.encode("utf-8") if isinstance(password, str) else password
    try:
        p12 = load_pkcs12(p12_bytes, pw)
    except Exception as e:
        err = str(e).lower()
        if any(k in err for k in ["mac verify", "pkcs12", "decrypt", "password", "bad decrypt", "invalid password"]):
            raise ValueError("wrong_password")
        raise ValueError(f"invalid_p12: {e}")

    cert = p12.cert.certificate if p12.cert else None
    if not cert:
        raise ValueError("no_cert: No certificate found in P12 file")

    subject = cert.subject

    def fmt_date(d):
        if d is None:
            return None
        if hasattr(d, 'strftime'):
            return d.strftime("%Y-%m-%d %H:%M")
        return str(d)

    # Try to get not_valid_before and not_valid_after (timezone-aware)
    try:
        not_before = cert.not_valid_before_utc
    except AttributeError:
        not_before = cert.not_valid_before.replace(tzinfo=timezone.utc)
    try:
        not_after = cert.not_valid_after_utc
    except AttributeError:
        not_after = cert.not_valid_after.replace(tzinfo=timezone.utc)

    cn = _get_attr(subject, NameOID.COMMON_NAME) or ""

    # Determine source
    source = "Other"
    if "iphone distribution" in cn.lower():
        source = "Apple Distribution"
    elif "iphone developer" in cn.lower() or "apple development" in cn.lower():
        source = "Apple Development"
    elif "mac app" in cn.lower():
        source = "Mac App Store"
    elif "developer id" in cn.lower():
        source = "Developer ID"

    # User ID: try USER_ID OID, fallback to OU
    user_id = _get_attr(subject, NameOID.USER_ID)
    if not user_id:
        user_id = _get_attr(subject, NameOID.ORGANIZATIONAL_UNIT_NAME)

    return {
        "user_id":      user_id or "",
        "common_name":  cn,
        "country":      _get_attr(subject, NameOID.COUNTRY_NAME) or "",
        "organization": _get_attr(subject, NameOID.ORGANIZATION_NAME) or "",
        "org_unit":     _get_attr(subject, NameOID.ORGANIZATIONAL_UNIT_NAME) or "",
        "not_before":   fmt_date(not_before),
        "not_after":    fmt_date(not_after),
        "source":       source,
    }


def _expand_entitlement(val):
    """Expand entitlement value for clean display."""
    if val is None:
        return "(empty)"
    if isinstance(val, list):
        if len(val) == 0:
            return "(empty)"
        if len(val) == 1:
            return val[0]
        return val
    return val


def parse_mobileprovision(mp_bytes: bytes) -> dict:
    """Parse a .mobileprovision file and extract profile + entitlements."""
    plist = None

    # Try direct parse first (for test/unwrapped data)
    try:
        plist = plistlib.loads(mp_bytes)
    except Exception:
        pass

    # Try to extract embedded plist from CMS-wrapped binary (real .mobileprovision)
    if plist is None:
        xml_start = mp_bytes.find(b'<?xml')
        if xml_start == -1:
            xml_start = mp_bytes.find(b'<plist')
        xml_end = mp_bytes.rfind(b'</plist>')
        if xml_start != -1 and xml_end != -1:
            try:
                plist = plistlib.loads(mp_bytes[xml_start:xml_end + 8])
            except Exception:
                pass

    # Try binary plist extraction
    if plist is None:
        for i in range(len(mp_bytes) - 6):
            if mp_bytes[i:i+6] == b'bplist':
                try:
                    plist = plistlib.loads(mp_bytes[i:])
                    break
                except Exception:
                    continue

    if plist is None:
        raise ValueError("invalid_mobileprovision: Could not parse the provisioning profile")

    def fmt_date(d):
        if d is None:
            return None
        if isinstance(d, datetime):
            return d.strftime("%Y-%m-%d %H:%M")
        return str(d)

    entitlements = plist.get("Entitlements", {})
    team_ids = plist.get("TeamIdentifier", [])
    provisions_all = plist.get("ProvisionsAllDevices", False)

    # Profile type
    profile_type = "Unknown"
    if provisions_all:
        profile_type = "Enterprise (In-House)"
    elif plist.get("ProvisionedDevices"):
        profile_type = "Ad Hoc"
    elif entitlements.get("get-task-allow", False):
        profile_type = "Development"
    else:
        profile_type = "App Store / Distribution"

    # Aps environment
    aps_env = entitlements.get("aps-environment", "")
    aps_display = aps_env if aps_env else "(not set)"

    # Associated domains
    assoc_domains = entitlements.get("com.apple.developer.associated-domains", [])
    if isinstance(assoc_domains, list) and len(assoc_domains) > 0:
        assoc_display = assoc_domains
    elif assoc_domains:
        assoc_display = [str(assoc_domains)]
    else:
        assoc_display = "(none)"

    return {
        "name":             plist.get("Name", ""),
        "uuid":             plist.get("UUID", ""),
        "team_identifier":  team_ids[0] if team_ids else "",
        "team_name":        plist.get("TeamName", ""),
        "created_at":       fmt_date(plist.get("CreationDate")),
        "expires_at":       fmt_date(plist.get("ExpirationDate")),
        "profile_type":     profile_type,
        "entitlements": {
            "application_identifier":  _expand_entitlement(entitlements.get("application-identifier", "")),
            "aps_environment":         aps_display,
            "associated_domains":      assoc_display,
            "team_identifier":         _expand_entitlement(entitlements.get("com.apple.developer.team-identifier", "")),
            "application_groups":      _expand_entitlement(entitlements.get("application-groups", [])),
            "get_task_allow":          entitlements.get("get-task-allow", False),
            "keychain_access_groups":  _expand_entitlement(entitlements.get("keychain-access-groups", [])),
        }
    }


def change_p12_password(p12_bytes: bytes, old_password: str, new_password: str) -> bytes:
    """Re-export a P12 with a new password."""
    from cryptography.hazmat.primitives.serialization.pkcs12 import load_pkcs12, serialize_key_and_certificates
    from cryptography.hazmat.primitives import serialization

    old_pw = old_password.encode("utf-8") if isinstance(old_password, str) else old_password
    new_pw = new_password.encode("utf-8") if isinstance(new_password, str) else new_password

    try:
        p12 = load_pkcs12(p12_bytes, old_pw)
    except Exception as e:
        err = str(e).lower()
        if any(k in err for k in ["mac verify", "pkcs12", "decrypt", "password", "bad decrypt", "invalid password"]):
            raise ValueError("wrong_password")
        raise ValueError(f"invalid_p12: {e}")

    friendly_name = p12.cert.friendly_name if p12.cert else b"cert"
    cert_obj = p12.cert.certificate if p12.cert else None
    additional = [ca.certificate for ca in (p12.additional_certs or [])]

    new_p12_bytes = serialize_key_and_certificates(
        name=friendly_name,
        key=p12.key,
        cert=cert_obj,
        cas=additional,
        encryption_algorithm=serialization.BestAvailableEncryption(new_pw)
    )
    return new_p12_bytes


def extract_p12_and_mp_from_zip(zip_bytes: bytes) -> Tuple[Optional[bytes], Optional[bytes]]:
    """Extract the first .p12 and .mobileprovision files from a zip."""
    extracted_p12 = None
    extracted_mp = None
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
            for name in zf.namelist():
                lower = name.lower()
                # Skip macOS metadata
                if '__macosx' in lower or name.startswith('.'):
                    continue
                if lower.endswith('.p12') and extracted_p12 is None:
                    extracted_p12 = zf.read(name)
                elif lower.endswith('.mobileprovision') and extracted_mp is None:
                    extracted_mp = zf.read(name)
    except zipfile.BadZipFile:
        raise ValueError("invalid_zip: The uploaded file is not a valid ZIP archive")
    except Exception as e:
        raise ValueError(f"zip_error: {e}")
    return extracted_p12, extracted_mp


def create_output_zip(p12_bytes: bytes, mp_bytes: bytes, new_password: str) -> bytes:
    """Create the output zip with cert.p12, cert.mobileprovision, password.txt."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("cert.p12", p12_bytes)
        zf.writestr("cert.mobileprovision", mp_bytes)
        zf.writestr("password.txt", new_password)
    buf.seek(0)
    return buf.read()
