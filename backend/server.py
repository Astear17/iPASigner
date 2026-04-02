import os
import io
import uuid
import asyncio
import plistlib
import subprocess
import zipfile
import shutil
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import aiofiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import httpx

from cert_tools import (
    load_pkcs12_info,
    parse_mobileprovision,
    change_p12_password,
    extract_p12_and_mp_from_zip,
    create_output_zip,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# ── Config ──────────────────────────────────────────────────────────────────
MONGO_URL         = os.environ.get("MONGO_URL", "mongodb+srv://Astear17:Astear17!@astear17.ivwcsvd.mongodb.net/?appName=Astear17")
DB_NAME           = os.environ.get("DB_NAME", "ipa_signer")
PUBLIC_BASE_URL   = os.environ.get("PUBLIC_BASE_URL", "https://ipa-signer-backend.onrender.com/")
ZSIGN_PATH        = os.environ.get("ZSIGN_PATH", "/usr/local/bin/zsign")
JOBS_DIR          = Path("/tmp/ipa_signer_jobs")
JOBS_DIR.mkdir(parents=True, exist_ok=True)
JOB_TTL_SECONDS   = int(os.environ.get("JOB_TTL_SECONDS", 30 * 60))
MAX_FILE_SIZE     = int(os.environ.get("MAX_FILE_SIZE_MB", 500)) * 1024 * 1024
ZSIGN_TIMEOUT     = int(os.environ.get("ZSIGN_TIMEOUT", 300))
CLEANUP_INTERVAL  = int(os.environ.get("CLEANUP_INTERVAL", 300))
MAX_CONCURRENT    = int(os.environ.get("MAX_CONCURRENT_JOBS", 5))
URL_DOWNLOAD_TIMEOUT = 120

_active_jobs = 0

# ── App Library ─────────────────────────────────────────────────────────────
APP_LIBRARY = [
    {
        "id": "feather",
        "name": "Feather",
        "version": "v2.5.0",
        "description": "Open-source on-device signer with tweak injection & AltStore repo support.",
        "ipa_url": "https://github.com/CLARATION/Feather/releases/download/v2.6.0/Feather.ipa",
        "website": "https://github.com/khcrysalis/Feather",
        "color": "#22D3EE",
        "features": ["iOS 16+"],
        "icon_url": "https://feather.khcrysalis.dev/feather.png",
    },
    {
        "id": "gbox",
        "name": "GBox",
        "version": "v5.7.6",
        "description": "Lightweight iOS signing & testing tool supporting iOS 12 through 26.",
        "ipa_url": "https://cdn.gbox.run/d/apps/GBox_v6.0.ipa",
        "website": "https://gbox.run",
        "color": "#F59E0B",
        "features": ["iOS 12+", "Easy to use", "Lightweight"],
        "icon_url": "https://gbox.run/Public/resources/icon256.png",
    },
    {
        "id": "ksign",
        "name": "KSign",
        "version": "v1.5.1",
        "description": "Free on-device signer with automatic signing & easy certificate import.",
        "ipa_url": "https://github.com/Nyasami/Ksign/releases/download/beta/Ksign.ipa",
        "website": "https://github.com/Nyasami/Ksign",
        "color": "#3B82F6",
        "features": ["iOS 16+", "Bulk Signing", "Recommended"],
        "icon_url": "https://raw.githubusercontent.com/Nyasami/Ksign/refs/heads/main/Ksign/Resources/Assets.xcassets/AppIcon.appiconset/Ksign-default.png",
    },
    {
        "id": "esign",
        "name": "ESign",
        "version": "v5.0",
        "description": "Popular sideloading solution with built-in certificate management.",
        "ipa_url": "https://github.com/Astear17/iDevicePatcher/releases/download/2.0/ESign.ipa",
        "website": "https://esign.yyyue.xyz",
        "color": "#8B5CF6",
        "features": ["iOS 12+", "Most Compatible", "Will Shut Down"],
        "icon_url": "https://raw.githubusercontent.com/Astear17/iDevicePatcher/refs/heads/main/ESign.png",
    },
    {
        "id": "scarlet",
        "name": "Scarlet",
        "version": "2025",
        "description": "Clean sideloading UI with no PC required, supporting the latest iOS versions.",
        "ipa_url": "https://resources.usescarlet.com/repo/IPAs/ScarletAlpha.ipa",
        "website": "https://usescarlet.com",
        "color": "#EF4444",
        "features": ["iOS 15+", "Clean UI"],
        "icon_url": "https://th.bing.com/th/id/OIP.5DztZ66VtLUD7iCT1ozHnAHaHa?w=200&h=200&c=12&rs=1&p=0&r=0&o=6&pid=23.1",
    },
]

# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(cleanup_loop())
    logger.info("Background cleanup loop started")
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="iOS SignTool API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

client_mongo = AsyncIOMotorClient(MONGO_URL)
db = client_mongo[DB_NAME]
jobs_col = db["ipa_sign_jobs"]

# ── Router ────────────────────────────────────────────────────────────────────
api_router = APIRouter(prefix="/api")

# ── Helpers (Sign IPA) ────────────────────────────────────────────────────────
def extract_ipa_metadata(ipa_path: str) -> dict:
    try:
        with zipfile.ZipFile(ipa_path, 'r') as zf:
            info_plist_path = None
            for name in zf.namelist():
                parts = Path(name).parts
                if (len(parts) == 3 and parts[0] == "Payload"
                        and parts[1].endswith(".app") and parts[2] == "Info.plist"):
                    info_plist_path = name
                    break
            if not info_plist_path:
                for name in zf.namelist():
                    if name.startswith("Payload/") and name.endswith("/Info.plist"):
                        info_plist_path = name
                        break
            if not info_plist_path:
                return {"bundle_id": "com.unknown.app", "bundle_name": "App", "bundle_version": "1.0"}
            with zf.open(info_plist_path) as f:
                info = plistlib.load(f)
        return {
            "bundle_id":      info.get("CFBundleIdentifier", "com.unknown.app"),
            "bundle_name":    info.get("CFBundleDisplayName") or info.get("CFBundleName", "App"),
            "bundle_version": info.get("CFBundleShortVersionString") or info.get("CFBundleVersion", "1.0"),
        }
    except Exception as e:
        logger.warning(f"iPA metadata extraction failed: {e}")
        return {"bundle_id": "com.unknown.app", "bundle_name": "App", "bundle_version": "1.0"}


def generate_manifest_plist(ipa_url, bundle_id, bundle_name, bundle_version) -> str:
    manifest = {"items": [{
        "assets": [{"kind": "software-package", "url": ipa_url}],
        "metadata": {
            "bundle-identifier": bundle_id,
            "bundle-version":    bundle_version,
            "kind":              "software",
            "title":             bundle_name,
        }
    }]}
    return plistlib.dumps(manifest, fmt=plistlib.FMT_XML).decode("utf-8")


def parse_zsign_error(log: str) -> str:
    log_lower = log.lower()
    if any(k in log_lower for k in ["mac verify error", "wrong password", "can't get privatekey", "incorrect password"]):
        return "Wrong .p12 password. Please verify your certificate password and try again."
    if "pkcs12" in log_lower and "error" in log_lower:
        return "Invalid or corrupted .p12 file."
    if "can't find teamid" in log_lower or ("teamid" in log_lower and "error" in log_lower):
        return "Certificate missing Team ID. Use a valid Apple Developer or Enterprise certificate."
    if "mobileprovision" in log_lower and ("invalid" in log_lower or "error" in log_lower):
        return "Invalid or corrupted .mobileprovision file."
    if "expir" in log_lower:
        return "Certificate / provisioning profile has expired."
    if "revok" in log_lower:
        return "Certificate has been revoked."
    lines = [l.strip() for l in log.split("\n") if l.strip() and (">>>" in l or "error" in l.lower())]
    if lines:
        return lines[0].replace(">>>", "").strip()[:300]
    return "Signing failed. Verify your certificate, password, and provisioning profile."


async def download_ipa_from_url(url: str, dest_path: str) -> None:
    logger.info(f"Downloading iPA from URL: {url}")
    async with httpx.AsyncClient(follow_redirects=True, timeout=URL_DOWNLOAD_TIMEOUT) as client:
        async with client.stream("GET", url, headers={"User-Agent": "iPA-Signer/1.0"}) as resp:
            if resp.status_code != 200:
                raise HTTPException(400, f"Failed to download iPA from URL: HTTP {resp.status_code}")
            content_type = resp.headers.get("content-type", "")
            allowed_types = ["application/octet-stream", "application/zip", "application/x-zip"]
            is_ipa_ext = url.lower().split("?")[0].endswith(".ipa")
            if not is_ipa_ext and not any(t in content_type for t in allowed_types):
                raise HTTPException(400, f"URL does not appear to be an iPA file")
            total = 0
            async with aiofiles.open(dest_path, "wb") as f:
                async for chunk in resp.aiter_bytes(chunk_size=1024 * 1024):
                    total += len(chunk)
                    if total > MAX_FILE_SIZE:
                        raise HTTPException(413, f"iPA exceeds max size")
                    await f.write(chunk)


async def cleanup_expired_jobs():
    try:
        now = datetime.utcnow()
        expired = await jobs_col.find({"expires_at": {"$lt": now}}).to_list(length=200)
        cleaned = 0
        for job in expired:
            jid = job["job_id"]
            jdir = JOBS_DIR / jid
            if jdir.exists():
                shutil.rmtree(jdir, ignore_errors=True)
            await jobs_col.delete_one({"job_id": jid})
            cleaned += 1
        if cleaned:
            logger.info(f"Cleanup: removed {cleaned} expired job(s)")
    except Exception as e:
        logger.warning(f"Cleanup error: {e}")


async def cleanup_loop():
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL)
        await cleanup_expired_jobs()


async def sign_ipa_task(job_id, job_dir, ipa_path, p12_path, password, prov_path, original_filename):
    global _active_jobs
    _active_jobs += 1
    try:
        stage_times = {"started": datetime.utcnow().isoformat()}
        await jobs_col.update_one(
            {"job_id": job_id},
            {"$set": {"status": "signing", "step": 1, "stage_times": stage_times}}
        )

        output_dir = job_dir / "output"
        output_dir.mkdir(exist_ok=True)
        output_ipa = output_dir / "app.ipa"
        tmp_folder = job_dir / "tmp_zsign"
        tmp_folder.mkdir(exist_ok=True)

        cmd = [
            ZSIGN_PATH,
            "-k", str(p12_path),
            "-p", password,
            "-m", str(prov_path),
            "-o", str(output_ipa),
            "-t", str(tmp_folder),
            "-z", "9",
            str(ipa_path)
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=ZSIGN_TIMEOUT)
        log_out = (result.stdout or "") + (result.stderr or "")
        combined = log_out.strip()

        if result.returncode != 0 or not output_ipa.exists():
            err = parse_zsign_error(combined)
            await jobs_col.update_one(
                {"job_id": job_id},
                {"$set": {"status": "failed", "step": 1, "error": err, "logs": combined[:2000],
                           "expires_at": datetime.utcnow() + timedelta(seconds=JOB_TTL_SECONDS)}}
            )
            return

        await jobs_col.update_one({"job_id": job_id}, {"$set": {"status": "generating", "step": 2}})
        stage_times["signed"] = datetime.utcnow().isoformat()

        meta = extract_ipa_metadata(str(output_ipa))
        ipa_url = f"{PUBLIC_BASE_URL}/api/public/{job_id}/app.ipa"
        manifest_url = f"{PUBLIC_BASE_URL}/api/public/{job_id}/manifest.plist"
        manifest_xml = generate_manifest_plist(ipa_url, meta["bundle_id"], meta["bundle_name"], meta["bundle_version"])

        async with aiofiles.open(output_dir / "manifest.plist", "w", encoding="utf-8") as f:
            await f.write(manifest_xml)

        install_link = f"itms-services://?action=download-manifest&url={manifest_url}"
        expires_at = datetime.utcnow() + timedelta(seconds=JOB_TTL_SECONDS)
        stage_times["done"] = datetime.utcnow().isoformat()

        await jobs_col.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "success", "step": 3,
                "ipa_url": ipa_url,
                "manifest_url": manifest_url,
                "install_link": install_link,
                "bundle_id": meta["bundle_id"],
                "bundle_name": meta["bundle_name"],
                "bundle_version": meta["bundle_version"],
                "expires_at": expires_at,
                "logs": combined[:2000],
                "stage_times": stage_times,
            }}
        )
        logger.info(f"[{job_id}] Success. {meta['bundle_id']}")

    except subprocess.TimeoutExpired:
        await jobs_col.update_one(
            {"job_id": job_id},
            {"$set": {"status": "failed", "step": 1,
                      "error": f"Signing timed out after {ZSIGN_TIMEOUT}s.",
                      "expires_at": datetime.utcnow() + timedelta(seconds=JOB_TTL_SECONDS)}}
        )
    except Exception as e:
        logger.exception(f"[{job_id}] Signing error")
        await jobs_col.update_one(
            {"job_id": job_id},
            {"$set": {"status": "failed", "step": 1,
                      "error": f"An error occurred: {str(e)[:200]}",
                      "expires_at": datetime.utcnow() + timedelta(seconds=JOB_TTL_SECONDS)}}
        )
    finally:
        _active_jobs -= 1
        for p in [Path(p12_path), Path(prov_path)]:
            try:
                if p.exists(): p.unlink()
            except Exception:
                pass


async def download_then_sign_task(job_id, job_dir, ipa_path_str, ipa_url_str, p12_path, password, prov_path, original_filename):
    global _active_jobs
    _active_jobs += 1
    try:
        await jobs_col.update_one({"job_id": job_id}, {"$set": {"status": "downloading", "step": 0}})
        try:
            await download_ipa_from_url(ipa_url_str, ipa_path_str)
        except HTTPException as e:
            await jobs_col.update_one(
                {"job_id": job_id},
                {"$set": {"status": "failed", "step": 0, "error": e.detail,
                          "expires_at": datetime.utcnow() + timedelta(seconds=JOB_TTL_SECONDS)}}
            )
            return
        except Exception as e:
            await jobs_col.update_one(
                {"job_id": job_id},
                {"$set": {"status": "failed", "step": 0, "error": f"Download failed: {str(e)[:300]}",
                          "expires_at": datetime.utcnow() + timedelta(seconds=JOB_TTL_SECONDS)}}
            )
            return
        if not zipfile.is_zipfile(ipa_path_str):
            await jobs_col.update_one(
                {"job_id": job_id},
                {"$set": {"status": "failed", "step": 0, "error": "Downloaded file is not a valid iPA archive.",
                          "expires_at": datetime.utcnow() + timedelta(seconds=JOB_TTL_SECONDS)}}
            )
            return
    finally:
        _active_jobs -= 1
    await sign_ipa_task(job_id, job_dir, ipa_path_str, p12_path, password, prov_path, original_filename)


# ── Health ───────────────────────────────────────────────────────────────────
@api_router.get("/health")
async def health():
    return {
        "status": "ok",
        "zsign": ZSIGN_PATH,
        "zsign_available": Path(ZSIGN_PATH).exists(),
        "active_jobs": _active_jobs,
    }


# ── App Library ───────────────────────────────────────────────────────────────
@api_router.get("/apps")
async def get_app_library():
    return {"apps": APP_LIBRARY}


# ── Sign IPA ──────────────────────────────────────────────────────────────────
@api_router.post("/jobs")
@limiter.limit("10/minute")
async def create_sign_job(
    request: Request,
    background_tasks: BackgroundTasks,
    ipa_file: Optional[UploadFile] = File(None),
    ipa_url: Optional[str] = Form(None),
    p12_file: UploadFile = File(...),
    mobileprovision_file: UploadFile = File(...),
    password: str = Form(default=""),
    source_app: Optional[str] = Form(None),
):
    global _active_jobs
    if _active_jobs >= MAX_CONCURRENT:
        raise HTTPException(503, "Server is busy. Please try again later.")

    has_file = ipa_file is not None and (ipa_file.filename or "").lower().endswith(".ipa")
    has_url = bool(ipa_url and ipa_url.strip())
    if not has_file and not has_url:
        raise HTTPException(400, "Provide an iPA file or a valid iPA URL.")
    if has_file and has_url:
        has_url = False
    if has_url:
        url_clean = ipa_url.strip()
        if not url_clean.startswith(("http://", "https://")):
            raise HTTPException(400, "iPA URL must start with http:// or https://")

    if not (p12_file.filename or "").lower().endswith(".p12"):
        raise HTTPException(400, "Certificate file must have .p12 extension")
    if not (mobileprovision_file.filename or "").lower().endswith(".mobileprovision"):
        raise HTTPException(400, "Provisioning file must have .mobileprovision extension")

    job_id = str(uuid.uuid4())
    job_dir = JOBS_DIR / job_id
    input_dir = job_dir / "input"
    input_dir.mkdir(parents=True, exist_ok=True)

    ipa_path = input_dir / "app.ipa"
    p12_path = input_dir / "cert.p12"
    prov_path = input_dir / "app.mobileprovision"

    for upload, save_path in [(p12_file, p12_path), (mobileprovision_file, prov_path)]:
        try:
            async with aiofiles.open(save_path, "wb") as f:
                total = 0
                while True:
                    chunk = await upload.read(1024 * 1024)
                    if not chunk: break
                    total += len(chunk)
                    if total > 50 * 1024 * 1024:
                        shutil.rmtree(job_dir, ignore_errors=True)
                        raise HTTPException(413, f"'{upload.filename}' is too large.")
                    await f.write(chunk)
        except HTTPException:
            raise
        except Exception as e:
            shutil.rmtree(job_dir, ignore_errors=True)
            raise HTTPException(500, f"Failed to save file: {str(e)[:200]}")

    original_filename = "app.ipa"
    if has_file:
        original_filename = ipa_file.filename or "app.ipa"
        try:
            async with aiofiles.open(ipa_path, "wb") as f:
                total = 0
                while True:
                    chunk = await ipa_file.read(1024 * 1024)
                    if not chunk: break
                    total += len(chunk)
                    if total > MAX_FILE_SIZE:
                        shutil.rmtree(job_dir, ignore_errors=True)
                        raise HTTPException(413, f"iPA exceeds {MAX_FILE_SIZE // (1024*1024)} MB limit.")
                    await f.write(chunk)
        except HTTPException:
            raise
        except Exception as e:
            shutil.rmtree(job_dir, ignore_errors=True)
            raise HTTPException(500, f"Failed to save iPA: {str(e)[:200]}")

        try:
            if not zipfile.is_zipfile(str(ipa_path)):
                shutil.rmtree(job_dir, ignore_errors=True)
                raise HTTPException(400, "The iPA file is not a valid archive.")
        except HTTPException:
            raise
        except Exception:
            pass

    ipa_source = "url" if has_url else "file"
    now = datetime.utcnow()
    await jobs_col.insert_one({
        "job_id": job_id,
        "status": "queued",
        "step": 0,
        "original_filename": original_filename,
        "ipa_source": ipa_source,
        "ipa_url_source": ipa_url if has_url else None,
        "source_app": source_app,
        "created_at": now,
        "expires_at": None,
        "ipa_url": None,
        "manifest_url": None,
        "install_link": None,
        "error": None,
        "logs": None,
        "stage_times": {},
    })

    if has_url:
        background_tasks.add_task(
            download_then_sign_task,
            job_id, job_dir, str(ipa_path), ipa_url.strip(),
            str(p12_path), password, str(prov_path), original_filename
        )
    else:
        background_tasks.add_task(
            sign_ipa_task,
            job_id, job_dir, str(ipa_path), str(p12_path),
            password, str(prov_path), original_filename
        )

    return {"job_id": job_id, "status": "queued"}


@api_router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = await jobs_col.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found or expired.")
    for field in ["created_at", "expires_at"]:
        if job.get(field) and isinstance(job[field], datetime):
            job[field] = job[field].isoformat() + "Z"
    return job


@api_router.get("/public/{job_id}/app.ipa")
async def serve_signed_ipa(job_id: str):
    job = await jobs_col.find_one({"job_id": job_id})
    if not job:
        raise HTTPException(404, "Signed iPA not found or expired.")
    ipa_path = JOBS_DIR / job_id / "output" / "app.ipa"
    if not ipa_path.exists():
        raise HTTPException(404, "Signed iPA has been deleted.")
    orig = job.get("original_filename", "app.ipa")
    name = (orig.rsplit(".", 1)[0] + "_signed.ipa") if "." in orig else "signed_app.ipa"
    return FileResponse(path=str(ipa_path), media_type="application/octet-stream", filename=name)


@api_router.get("/public/{job_id}/manifest.plist")
async def serve_manifest(job_id: str):
    p = JOBS_DIR / job_id / "output" / "manifest.plist"
    if not p.exists():
        raise HTTPException(404, "Manifest not found or expired.")
    async with aiofiles.open(p, "r") as f:
        content = await f.read()
    return Response(content=content, media_type="text/xml",
                    headers={"Content-Type": "text/xml; charset=utf-8"})


# ── Check Certificate ─────────────────────────────────────────────────────────
@api_router.post("/check-cert")
@limiter.limit("30/minute")
async def check_certificate(
    request: Request,
    p12_file: UploadFile = File(...),
    mobileprovision_file: UploadFile = File(...),
    password: str = Form(default=""),
):
    """Parse P12 + mobileprovision and return certificate/profile info."""
    # Validate extensions
    if not (p12_file.filename or "").lower().endswith(".p12"):
        raise HTTPException(400, "Certificate file must have .p12 extension")
    if not (mobileprovision_file.filename or "").lower().endswith(".mobileprovision"):
        raise HTTPException(400, "Provisioning profile must have .mobileprovision extension")

    # Read files
    try:
        p12_bytes = await p12_file.read()
        mp_bytes = await mobileprovision_file.read()
    except Exception as e:
        raise HTTPException(500, f"Failed to read uploaded files: {e}")

    if len(p12_bytes) == 0:
        raise HTTPException(400, "P12 file is empty")
    if len(mp_bytes) == 0:
        raise HTTPException(400, "Mobileprovision file is empty")

    # Parse P12
    try:
        cert_info = load_pkcs12_info(p12_bytes, password)
    except ValueError as e:
        err = str(e)
        if "wrong_password" in err:
            raise HTTPException(401, "Wrong certificate password. Please double-check and try again.")
        elif "invalid_p12" in err:
            raise HTTPException(400, f"Invalid P12 file: {err.split('invalid_p12: ')[-1]}")
        elif "no_cert" in err:
            raise HTTPException(400, "No certificate found in P12 file")
        raise HTTPException(400, f"P12 error: {err}")
    except Exception as e:
        raise HTTPException(500, f"Failed to parse P12: {e}")

    # Parse mobileprovision
    try:
        profile_info = parse_mobileprovision(mp_bytes)
    except ValueError as e:
        raise HTTPException(400, f"Invalid provisioning profile: {e}")
    except Exception as e:
        raise HTTPException(500, f"Failed to parse provisioning profile: {e}")

    return {
        "certificate": {
            "user_id":      cert_info["user_id"],
            "common_name":  cert_info["common_name"],
            "country":      cert_info["country"],
            "organization": cert_info["organization"],
            "org_unit":     cert_info["org_unit"],
            "created_at":   cert_info["not_before"],
            "expires_at":   cert_info["not_after"],
            "source":       cert_info["source"],
        },
        "provisioning_profile": {
            "name":            profile_info["name"],
            "uuid":            profile_info["uuid"],
            "team_identifier": profile_info["team_identifier"],
            "team_name":       profile_info.get("team_name", ""),
            "created_at":      profile_info["created_at"],
            "expires_at":      profile_info["expires_at"],
            "profile_type":    profile_info.get("profile_type", "Unknown"),
        },
        "security": {
            "password_provided": bool(password),
            "password_display":  password if password else "(none)",
        },
        "entitlements": profile_info.get("entitlements", {}),
    }


# ── Change Certificate Password ───────────────────────────────────────────────
@api_router.post("/change-cert-password")
@limiter.limit("20/minute")
async def change_cert_password(
    request: Request,
    # Separate file mode
    p12_file: Optional[UploadFile] = File(None),
    mobileprovision_file: Optional[UploadFile] = File(None),
    # Zip mode
    bundle_zip: Optional[UploadFile] = File(None),
    # Passwords
    old_password: str = Form(default=""),
    new_password: str = Form(...),
):
    """Change P12 password. Accepts separate files OR a zip bundle. Returns zip."""
    p12_bytes = None
    mp_bytes = None

    # Determine mode
    has_p12 = p12_file is not None and (p12_file.filename or "").strip() != ""
    has_mp = mobileprovision_file is not None and (mobileprovision_file.filename or "").strip() != ""
    has_zip = bundle_zip is not None and (bundle_zip.filename or "").strip() != ""

    if not has_zip and not (has_p12 and has_mp):
        raise HTTPException(400, "Provide either a ZIP bundle OR both P12 and mobileprovision files separately.")

    if not new_password.strip():
        raise HTTPException(400, "New password cannot be empty")

    if has_zip:
        # Zip mode
        try:
            zip_bytes = await bundle_zip.read()
        except Exception as e:
            raise HTTPException(500, f"Failed to read ZIP: {e}")

        if len(zip_bytes) == 0:
            raise HTTPException(400, "ZIP file is empty")

        try:
            extracted_p12, extracted_mp = extract_p12_and_mp_from_zip(zip_bytes)
        except ValueError as e:
            err = str(e)
            if "invalid_zip" in err:
                raise HTTPException(400, "The uploaded file is not a valid ZIP archive")
            raise HTTPException(400, f"ZIP error: {err}")

        if extracted_p12 is None:
            raise HTTPException(400, "No .p12 file found inside the ZIP")
        if extracted_mp is None:
            raise HTTPException(400, "No .mobileprovision file found inside the ZIP")

        p12_bytes = extracted_p12
        mp_bytes = extracted_mp
    else:
        # Separate files mode
        if not (p12_file.filename or "").lower().endswith(".p12"):
            raise HTTPException(400, "Certificate file must have .p12 extension")
        if not (mobileprovision_file.filename or "").lower().endswith(".mobileprovision"):
            raise HTTPException(400, "Provisioning profile must have .mobileprovision extension")

        try:
            p12_bytes = await p12_file.read()
            mp_bytes = await mobileprovision_file.read()
        except Exception as e:
            raise HTTPException(500, f"Failed to read files: {e}")

        if len(p12_bytes) == 0:
            raise HTTPException(400, "P12 file is empty")
        if len(mp_bytes) == 0:
            raise HTTPException(400, "Mobileprovision file is empty")

    # Change the password
    try:
        new_p12_bytes = change_p12_password(p12_bytes, old_password, new_password)
    except ValueError as e:
        err = str(e)
        if "wrong_password" in err:
            raise HTTPException(401, "Wrong old certificate password. Please double-check and try again.")
        elif "invalid_p12" in err:
            raise HTTPException(400, f"Invalid P12 file: {err.split('invalid_p12: ')[-1]}")
        raise HTTPException(400, f"P12 error: {err}")
    except Exception as e:
        raise HTTPException(500, f"Failed to change password: {e}")

    # Build output ZIP
    try:
        output_zip_bytes = create_output_zip(new_p12_bytes, mp_bytes, new_password)
    except Exception as e:
        raise HTTPException(500, f"Failed to create output ZIP: {e}")

    return StreamingResponse(
        io.BytesIO(output_zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=\"ios_cert_bundle.zip\""},
    )


# ── Register router ───────────────────────────────────────────────────────────
app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client_mongo.close()
