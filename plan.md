# plan.md — iOS SignTool

## 1. Objectives
- Clone/extend **Astear17/iPASigner** into **iOS SignTool** with 3 tools:
  - **Sign iPA** (existing) at `/signipa` (preserve current flow + Mongo job tracking).
  - **Check Certificate Validity** at `/checkcert` (p12+mobileprovision+password → detailed parsed info + entitlements shown below form).
  - **Change Certificate Password** at `/certpass` (p12+mobileprovision OR zip + old/new password → download zip with `cert.p12`, `cert.mobileprovision`, `password.txt`).
- UI/UX: adopt **iDevicePatcher glass** look (fixed pill header, glass cards, blue/purple radial gradient), keep **existing dark theme**, **no** theme toggle, Inter font, footer text: **“Built and deployed by Astear17”**.
- Routing/navigation:
  - `/` home with 3 feature cards + CTA buttons that route to `/signipa`, `/checkcert`, `/certpass`.
  - Top navbar links across all pages.
- Deployment: Vercel (frontend) + Render (backend Docker) + `DEPLOY.md`.

## 2. Implementation Steps

### Phase 1 — Core POC (isolation, fix-until-works)
**Goal:** prove certificate/profile parsing + p12 re-encryption works reliably before building UI.

1) **Web research (best practice quick pass)**
- Confirm recommended approach for parsing `.mobileprovision` (CMS wrapper → plist) and PKCS12 re-export with `cryptography`.

2) **Add POC scripts under `backend/poc/` (not part of API yet)**
- `poc_checkcert.py`
  - Inputs: `--p12`, `--mobileprovision`, `--password`.
  - Outputs (stdout JSON): cert fields + profile fields + entitlements subset.
- `poc_certpass.py`
  - Inputs: `--p12`, `--mobileprovision`, `--oldpass`, `--newpass`.
  - Writes new p12, copies mobileprovision, creates password.txt, zips all.

3) **Implement core helpers (shared, to be reused by API)**
- `backend/cert_tools.py`
  - `load_pkcs12_info(p12_bytes, password) -> {user_id, cn, c, o, ou, not_before, not_after, source}`
  - `parse_mobileprovision(mp_bytes) -> {name, uuid, team_ids, created, expires, entitlements}`
  - `change_p12_password(p12_bytes, old, new) -> new_p12_bytes`
  - `extract_p12_and_mp_from_zip(zip_bytes) -> (p12_bytes, mp_bytes)` (for `/certpass` zip mode)

4) **POC validation matrix (must pass before Phase 2)**
- Correct password → parsed fields populated; expirations correct; entitlements extracted.
- Wrong password → clean error classification (wrong password vs corrupted file).
- Password change → output p12 loads with new password and fails with old.
- Zip input with various filenames inside (find first `.p12` + `.mobileprovision`).

### Phase 2 — V1 App Development (MVP)
**Backend (FastAPI) — add endpoints, reuse POC helpers**
1) Add API routes:
- `POST /api/check-cert`
  - Multipart: `p12_file`, `mobileprovision_file`, `password`.
  - Returns JSON with:
    - Certificate: User ID, Common Name, Country, Organization, Org Unit, Created At, Expires At, Source
    - Profile: Name, UUID, Team Identifier(s), Created At, Expires At
    - Security: password echoed as provided
    - Entitlements: application-identifier, aps-environment, associated-domains, team-identifier, application-groups, get-task-allow, keychain-access-groups
- `POST /api/change-cert-password`
  - Multipart supports either:
    - `p12_file` + `mobileprovision_file`, OR `bundle_zip`
  - Plus `old_password`, `new_password`
  - Response: `application/zip` attachment containing `cert.p12`, `cert.mobileprovision`, `password.txt`

2) Error handling contracts (front-end friendly)
- Standardize `{detail: "..."}` for 4xx; distinguish:
  - wrong password
  - missing required file(s)
  - invalid/corrupt p12
  - invalid/corrupt mobileprovision
  - zip missing p12/mp

3) Keep existing signing APIs untouched (`/api/jobs`, `/api/jobs/{id}`, `/api/public/...`) and Mongo behavior.

**Frontend (React) — routing + pages**
4) Introduce React Router routes:
- `/` HomePage (3 cards)
- `/signipa` SignPage (wrap existing App.js sign UI, moved from `/`)
- `/checkcert` CheckCertPage
- `/certpass` CertPassPage

5) Create shared layout components:
- `TopNavGlass` fixed pill header with links: Home / Sign iPA / Check Cert / Cert Pass.
- `GlassCard` wrapper to apply iDevicePatcher-like glass style.
- Footer component: “Built and deployed by Astear17”.

6) Implement CheckCertPage UI
- Upload p12 + mobileprovision + password.
- Submit → call `/api/check-cert`.
- Render results **below the form** in sections (Certificate / Profile / Security / Entitlements).

7) Implement CertPassPage UI
- Two modes (tabs):
  - Separate uploads (p12 + mobileprovision)
  - Zip upload (bundle)
- Inputs: old/new password.
- Submit → triggers download of returned zip.
- Show inline errors (wrong old password, invalid zip, etc.).

8) Styling alignment
- Replace/extend existing dark theme background with iDevicePatcher-like radial gradient + glass blur.
- Ensure Inter font already used; remove/avoid any theme toggle UI.

9) Deployment docs
- Add `DEPLOY.md`:
  - Render deploy steps (Mongo optional/required only for signing; env vars; PUBLIC_BASE_URL)
  - Vercel deploy steps (REACT_APP_BACKEND_URL)
  - Smoke test URLs

10) Phase 2 testing (end-to-end)
- Run local: backend + frontend.
- Validate all 3 flows and navigation; ensure signing still works.

### Phase 3 — Hardening + regression testing
1) Add automated tests (backend)
- Unit tests for `cert_tools.py` with small fixtures (sanitized sample files if available; else generate minimal cert in test).
- API tests for `/api/check-cert` and `/api/change-cert-password` (error cases included).

2) UX polish
- Better field formatting (dates, arrays), copy-to-clipboard for key values.
- Consistent toast/inline status for network errors.

3) Performance/safety
- File size limits for cert endpoints; ensure temp files cleaned.
- Confirm CORS + headers remain correct.

4) Final regression pass across:
- `/signipa` job lifecycle
- `/checkcert` parsing
- `/certpass` zip download + changed password verification

## 3. Next Actions
1) Implement Phase 1 POC helpers + scripts in backend and validate with real p12/mobileprovision samples.
2) Once POC passes, wire helpers into FastAPI endpoints.
3) Refactor frontend into routed pages + shared glass navbar/layout.
4) Add `DEPLOY.md`, then do one full local E2E run + fix regressions.

## 4. Success Criteria
- Home page shows 3 feature cards and routes correctly to `/signipa`, `/checkcert`, `/certpass`.
- Top glass navbar present on all pages; footer shows “Built and deployed by Astear17”.
- `/signipa` preserves existing behavior (upload/url/library signing, job polling, OTA link, download).
- `/checkcert` returns and renders all required certificate/profile/security/entitlements fields; wrong password yields clear message.
- `/certpass` accepts both separate files and zip; returns a zip with correct filenames; new p12 opens with new password.
- Deployable with Vercel + Render following `DEPLOY.md` and env vars.