# plan.md — iOS SignTool (Updated)

## 1. Objectives
- Deliver **iOS SignTool** (extended from **Astear17/iPASigner**) as a multi-tool webapp with 3 features:
  - **Sign iPA** at `/signipa` (preserves original iPASigner signing flow + job polling + Mongo job tracking + OTA install link)
  - **Check Certificate Validity** at `/checkcert` (upload `.p12` + `.mobileprovision` + password → detailed certificate/profile/security/entitlements shown **below the form**)
  - **Change Certificate Password** at `/certpass` (upload `.p12` + `.mobileprovision` **OR** a single `.zip` bundle + old/new password → downloads zip containing `cert.p12`, `cert.mobileprovision`, `password.txt`)
- UI/UX:
  - Implement **iDevicePatcher-inspired glass** look: fixed pill-shaped glass header, glass cards, radial-orb background overlay
  - Keep **dark theme** (no light/dark toggle)
  - Inter font throughout
  - Footer text: **“Built and deployed by Astear17”**
- Routing/navigation:
  - `/` Home with 3 feature cards + CTA buttons that route to `/signipa`, `/checkcert`, `/certpass`
  - Fixed glass navbar links across all pages
- Deployment:
  - **Vercel** for frontend + **Render (Docker)** for backend
  - Provide **DEPLOY.md** with step-by-step guide

**Current Status:** ✅ Objectives implemented and verified end-to-end.

---

## 2. Implementation Steps

### Phase 1 — Core POC (isolation, fix-until-works)
**Goal:** prove certificate/profile parsing + p12 re-encryption works reliably before building UI.

**Status:** ✅ Completed. All POC tests passed.

1) **Web research (best practice quick pass)**
- Confirmed approach for parsing `.mobileprovision` (CMS wrapper → embedded plist scanning) and PKCS12 re-export using `cryptography`.

2) **POC scripts / harness**
- Implemented a POC harness (`/app/poc_cert_test.py`) covering:
  - P12 parsing (correct password)
  - P12 parsing (wrong password detection)
  - Mobileprovision plist parsing
  - P12 password change verification (new password works, old fails)
  - ZIP extraction of `.p12` + `.mobileprovision`
  - Output ZIP creation with correct files
  - Wrong old password detection for password change

3) **Implemented core shared helpers**
- Added `backend/cert_tools.py`:
  - `load_pkcs12_info(p12_bytes, password)`
  - `parse_mobileprovision(mp_bytes)`
  - `change_p12_password(p12_bytes, old, new)`
  - `extract_p12_and_mp_from_zip(zip_bytes)`
  - `create_output_zip(p12_bytes, mp_bytes, new_password)`

4) **POC validation matrix**
- ✅ Correct password → parsed fields populated
- ✅ Wrong password → clean error classification
- ✅ Password change → new p12 loads with new password; old password rejected
- ✅ ZIP input works with varied filenames; extracts first `.p12` and `.mobileprovision`

---

### Phase 2 — V1 App Development (MVP)
**Goal:** build full backend APIs and routed frontend UI using the glass theme.

**Status:** ✅ Completed. All frontend/backend tests passed at 100%.

**Backend (FastAPI)**
1) **Signing system (existing iPASigner functionality preserved)**
- Existing routes preserved:
  - `POST /api/jobs`
  - `GET /api/jobs/{job_id}`
  - `GET /api/public/{job_id}/app.ipa`
  - `GET /api/public/{job_id}/manifest.plist`
  - `GET /api/apps`
  - `GET /api/health`

2) **New API routes added**
- ✅ `POST /api/check-cert`
  - Multipart: `p12_file`, `mobileprovision_file`, `password`
  - Returns JSON:
    - Certificate: User ID, Common Name, Country, Organization, Org Unit, Created At, Expires At, Source
    - Provision profile: Name, UUID, Team ID, Team Name, Created/Expires, Profile Type
    - Security: password provided + display
    - Entitlements: application identifier, APS env, associated domains, team identifier, app groups, get-task-allow, keychain groups

- ✅ `POST /api/change-cert-password`
  - Multipart supports either:
    - `p12_file` + `mobileprovision_file`, OR `bundle_zip`
  - Plus `old_password`, `new_password`
  - Response: `application/zip` attachment containing `cert.p12`, `cert.mobileprovision`, `password.txt`

3) **Error handling contracts (front-end friendly)**
- ✅ Consistent `{detail: "..."}` for errors
- ✅ Clear classification for wrong password (401), invalid zip, missing files, invalid p12/mobileprovision

**Frontend (React)**
4) **Routing implemented with React Router**
- ✅ `/` HomePage
- ✅ `/signipa` SignIpaPage
- ✅ `/checkcert` CheckCertPage
- ✅ `/certpass` CertPassPage

5) **Shared layout components**
- ✅ Fixed glass pill navbar: `frontend/src/components/TopNav.js`
- ✅ Footer component: `frontend/src/components/SiteFooter.js`
- ✅ Reusable drag-drop upload component: `frontend/src/components/DropZone.js`

6) **HomePage implementation**
- ✅ 3 feature cards with descriptions and CTA buttons to routes

7) **CheckCertPage implementation**
- ✅ Upload p12 + mobileprovision + password
- ✅ Submit calls `/api/check-cert`
- ✅ Results rendered below form in sections:
  - Certificate
  - Provisioning Profile
  - Security
  - Entitlements

8) **CertPassPage implementation**
- ✅ Two modes:
  - Separate file uploads
  - ZIP bundle upload
- ✅ Old/new password inputs
- ✅ Download ZIP result
- ✅ Clear wrong-password message and error banners

9) **Styling alignment (glass + dark theme)**
- ✅ iDevicePatcher-inspired glass header/cards
- ✅ Dark radial orb background overlay + noise
- ✅ No light/dark toggle

10) **Deployment assets completed**
- ✅ `DEPLOY.md`
- ✅ `backend/Dockerfile` builds zsign
- ✅ `render.yaml` and `vercel.json`

11) **Phase 2 end-to-end testing**
- ✅ Automated/manual verification:
  - Pages load and navigate correctly
  - Form validation works
  - `/api/check-cert` works and returns expected structure
  - `/api/change-cert-password` returns 401 for wrong old password and returns valid ZIP for correct password
  - Overall testing result: **100% pass**

---

### Phase 3 — Hardening + regression testing
**Goal:** optional improvements after MVP completion.

**Status:** 🔜 Recommended next iteration (not required for current completion).

1) **Automated tests (backend)**
- Add unit tests for `cert_tools.py` using generated certificates (avoid committing sensitive fixtures)
- Add API tests for `/api/check-cert` and `/api/change-cert-password`

2) **UX polish**
- Add more copy-to-clipboard actions on key values (team id, uuid, app identifier)
- Improve formatting for long entitlement arrays (collapsible sections)

3) **Performance/safety**
- Add explicit file size limits for cert endpoints (separate from IPA limit)
- Ensure temp buffers/streams are bounded and safe

4) **Regression pass before production releases**
- `/signipa` full job lifecycle and OTA link generation
- `/checkcert` parsing correctness across real-world CMS-wrapped `.mobileprovision`
- `/certpass` output ZIP and password verification

---

## 3. Next Actions
**Current:** MVP complete and deploy-ready.

**Optional next steps:**
1) Add backend unit/API tests (pytest) for cert endpoints
2) Add small UI refinements (copy buttons, better entitlement formatting)
3) Production deploy to Vercel + Render using `DEPLOY.md`

---

## 4. Success Criteria
✅ Met.

- ✅ Home page shows 3 feature cards and routes correctly to `/signipa`, `/checkcert`, `/certpass`.
- ✅ Top glass navbar present on all pages; footer shows “Built and deployed by Astear17”.
- ✅ `/signipa` preserves original signing flow (upload/url/library, job polling, OTA link, download).
- ✅ `/checkcert` returns and renders required certificate/profile/security/entitlements fields; wrong password yields clear 401 error message.
- ✅ `/certpass` accepts both separate files and zip; returns a zip with correct filenames; changed p12 works with new password.
- ✅ Deployable with Vercel + Render following `DEPLOY.md` and env vars.
