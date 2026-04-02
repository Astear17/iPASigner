import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import {
  Upload, FileCheck, Lock, Loader2, CheckCircle2, AlertCircle,
  Download, Copy, Check, Clock, RefreshCw, Shield, Smartphone,
  FileArchive, KeyRound, ClipboardList, Eye, EyeOff, X,
  RotateCcw, Trash2, Link2, Layers, HardDrive, FileSignature
} from 'lucide-react';
import DropZone from '../components/DropZone';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const POLL_INTERVAL = 2000;
const MAX_IPA_MB = 500;
const WARN_IPA_MB = 200;

function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function mbSize(file) { return file ? file.size / 1024 / 1024 : 0; }
function isPasswordError(e) {
  if (!e) return false;
  const l = e.toLowerCase();
  return l.includes('password') || l.includes('p12') || l.includes('pkcs12') || l.includes('mac verify');
}

function useAppLibrary() {
  const [apps, setApps] = useState([]);
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/apps`)
      .then(r => r.json())
      .then(d => setApps(d.apps || []))
      .catch(() => {});
  }, []);
  return apps;
}

function AppIcon({ icon_url, name, color, size = 44 }) {
  return (
    <div style={{
      width: size, height: size,
      background: `linear-gradient(135deg, ${color}33, ${color}22)`,
      border: `1.5px solid ${color}55`,
      borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden',
    }}>
      <img src={icon_url} alt={name} style={{ width: size, height: size, objectFit: 'cover' }} />
    </div>
  );
}

const SOURCE_TABS = [
  { id: 'file',    label: 'Upload File', icon: Upload },
  { id: 'url',     label: 'From URL',    icon: Link2 },
  { id: 'library', label: 'App Library', icon: Layers },
];

function SourceTabs({ active, onChange }) {
  return (
    <div className="flex items-center gap-1 rounded-xl p-1 mb-5"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      data-testid="signipa-source-tabs"
    >
      {SOURCE_TABS.map(tab => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors ${
              isActive
                ? 'bg-white/8 text-foreground border border-white/12'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function AppCard({ app, selected, onSelect }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => onSelect(app)}
      className={`relative rounded-xl border p-3.5 cursor-pointer ${
        selected ? 'border-cyan-500/60 bg-cyan-500/8' : 'border-border bg-card hover:border-border/80'
      }`}
    >
      <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
        selected ? 'border-cyan-400 bg-cyan-400' : 'border-border'
      }`}>
        {selected && <Check size={11} className="text-background" strokeWidth={3} />}
      </div>
      <div className="flex items-start gap-3">
        <img src={app.icon_url} alt={app.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{app.name}</span>
            <span className="text-xs font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{app.version}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 pr-6">{app.description}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {app.features.map(f => (
              <span key={f} className="text-xs px-1.5 py-0.5 rounded bg-secondary/80 text-muted-foreground">{f}</span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const STEPS = [
  { id: 0, label: 'Uploading',  icon: Upload },
  { id: 1, label: 'Signing',    icon: Shield },
  { id: 2, label: 'Generating', icon: ClipboardList },
  { id: 3, label: 'Done',       icon: CheckCircle2 },
];

function ProgressSteps({ step }) {
  return (
    <div data-testid="signipa-progress" className="flex items-center justify-between w-full py-2">
      {STEPS.map((s, i) => {
        const status = step > s.id ? 'done' : step === s.id ? 'active' : 'pending';
        return (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                status === 'done'   ? 'border-emerald-500 bg-emerald-500/20' :
                status === 'active' ? 'border-cyan-400 bg-cyan-400/10' :
                                     'border-border bg-card'
              }`}>
                {status === 'done'   ? <Check size={14} className="text-emerald-400" /> :
                 status === 'active' ? <Loader2 size={14} className="text-cyan-400 animate-spin" /> :
                                      <s.icon size={14} className="text-muted-foreground" />}
              </div>
              <span className={`text-xs font-medium ${
                status === 'done' ? 'text-emerald-400' : status === 'active' ? 'text-cyan-400' : 'text-muted-foreground'
              }`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 transition-colors ${
                step > s.id ? 'bg-emerald-500/50' : 'bg-border'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function QRCodeDisplay({ url }) {
  const [dataUrl, setDataUrl] = useState(null);
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 200, margin: 2, errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' } })
      .then(setDataUrl).catch(console.error);
  }, [url]);
  if (!dataUrl) return <div className="qr-container" style={{ width: 200, height: 200 }}><Loader2 className="animate-spin text-gray-400" size={28} /></div>;
  return (
    <div className="qr-container" data-testid="signed-ipa-qr-code">
      <img src={dataUrl} alt="Scan QR to install" width={200} height={200} />
    </div>
  );
}

function CountdownTimer({ expiresAt }) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!expiresAt) return;
    const expiry = new Date(expiresAt).getTime();
    const upd = () => setRemaining(Math.max(0, expiry - Date.now()));
    upd();
    const t = setInterval(upd, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (remaining === null) return null;
  const isWarn = remaining < 5 * 60 * 1000;
  const isExpired = remaining === 0;
  return (
    <div className="flex flex-col gap-2">
      <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs border ${
        isExpired ? 'border-red-500/50 bg-red-500/10 text-red-400' :
        isWarn    ? 'border-orange-500/50 bg-orange-500/10 text-orange-400 warning-pulse' :
                    'border-border bg-secondary text-muted-foreground'
      }`}>
        <Clock size={12} />
        {isExpired ? 'Expired — files deleted' : `Files expire in ${formatCountdown(remaining)}`}
      </div>
      {isWarn && !isExpired && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-300">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>Files expire in 5 minutes. Download the signed IPA now before it’s deleted.</span>
        </div>
      )}
    </div>
  );
}

function ErrorView({ error, onRetry, onFullReset, isPasswordErr, appLibrary }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="text-red-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-300 mb-1">
            {isPasswordErr ? 'Wrong Certificate Password' : 'Signing Failed'}
          </h3>
          <p className="text-sm text-red-200/80 mb-3">{error}</p>
          {isPasswordErr && (
            <div className="mb-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2.5 text-xs text-orange-200">
              <p className="font-semibold mb-1">Quick fix:</p>
              <ul className="space-y-0.5 list-disc list-inside text-orange-200/80">
                <li>Re-enter the password — it’s case-sensitive</li>
                <li>Re-export the .p12 from Keychain and set a new password</li>
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={onRetry}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-card border border-border text-sm font-medium hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-colors cursor-pointer">
          <RotateCcw size={14} />{isPasswordErr ? 'Fix password & retry' : 'Try again'}
        </button>
        <button onClick={onFullReset}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <Trash2 size={13} />Start over
        </button>
      </div>
    </div>
  );
}

function SuccessView({ job, onReset }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(job.install_link);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }} className="space-y-5" data-testid="signipa-success-card">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
        <div>
          <p className="font-semibold text-emerald-300">Signing Complete</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {job.bundle_name}&nbsp;&middot;&nbsp;{job.bundle_id}&nbsp;&middot;&nbsp;v{job.bundle_version}
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex flex-col items-center gap-2 shrink-0 w-full md:w-auto">
            <QRCodeDisplay url={job.install_link} />
            <p className="text-xs text-muted-foreground text-center">Scan with iPhone/iPad<br />to install directly</p>
          </div>
          <div className="flex-1 space-y-4 w-full">
            <a href={job.install_link}
              className="install-btn flex items-center justify-center gap-2.5 h-14 w-full rounded-2xl text-base font-semibold text-white shadow-lg"
              style={{ textDecoration: 'none' }}>
              <Smartphone size={20} />Install on iPhone / iPad
            </a>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Install Link</p>
              <div className="flex items-center gap-2">
                <div className="url-row flex-1 text-xs">{job.install_link}</div>
                <button onClick={handleCopy}
                  className={`shrink-0 p-2 rounded-lg border border-border hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-colors ${
                    copied ? 'border-emerald-500/50 bg-emerald-500/10' : ''
                  }`}>
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-muted-foreground" />}
                </button>
              </div>
            </div>
            <a href={`${BACKEND_URL}/api/public/${job.job_id}/app.ipa`} download="signed_app.ipa"
              data-testid="download-signed-ipa-button"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
              style={{ textDecoration: 'none' }}>
              <Download size={16} />Download Signed IPA
            </a>
            <CountdownTimer expiresAt={job.expires_at} />
          </div>
        </div>
      </div>
      <button onClick={onReset}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        <RefreshCw size={14} />Sign another IPA
      </button>
    </motion.div>
  );
}

function SignForm({ ipaFile, setIpaFile, p12File, setP12File, provFile, setProvFile, password, setPassword, onJobStarted, appLibrary }) {
  const [sourceMode, setSourceMode] = useState('file');
  const [ipaUrl, setIpaUrl] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);

  const isFileMode = sourceMode === 'file';
  const isUrlMode  = sourceMode === 'url';
  const isLibMode  = sourceMode === 'library';

  const handleTabChange = (tab) => { setSourceMode(tab); setUploadErr(null); if (tab !== 'library') setSelectedApp(null); };
  const handleSelectApp = (app) => { setSelectedApp(prev => prev?.id === app.id ? null : app); setUploadErr(null); };

  const ipaReady = isFileMode ? Boolean(ipaFile) : isUrlMode ? ipaUrl.trim().startsWith('http') : Boolean(selectedApp);
  const canSubmit = ipaReady && Boolean(p12File) && Boolean(provFile);
  const ipaWarn = ipaFile && mbSize(ipaFile) > WARN_IPA_MB;
  const ipaOver = ipaFile && mbSize(ipaFile) > MAX_IPA_MB;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (ipaOver) { setUploadErr(`IPA is too large (${mbSize(ipaFile).toFixed(0)} MB). Max: ${MAX_IPA_MB} MB.`); return; }
    setLoading(true); setUploadErr(null);
    try {
      const fd = new FormData();
      fd.append('p12_file', p12File);
      fd.append('mobileprovision_file', provFile);
      fd.append('password', password);
      if (isFileMode) fd.append('ipa_file', ipaFile);
      else if (isUrlMode) fd.append('ipa_url', ipaUrl.trim());
      else if (isLibMode && selectedApp) fd.append('ipa_url', selectedApp.ipa_url);

      const res = await fetch(`${BACKEND_URL}/api/jobs`, { method: 'POST', body: fd });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Server error: ${res.status}`); }
      const data = await res.json();
      onJobStarted(data.job_id);
    } catch (err) {
      setUploadErr(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <SourceTabs active={sourceMode} onChange={handleTabChange} />

      <AnimatePresence mode="wait">
        {isFileMode && (
          <motion.div key="file" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <DropZone label="IPA File" accept=".ipa" icon={FileArchive}
              file={ipaFile} onFile={f => { setIpaFile(f); setUploadErr(null); }} onClear={() => setIpaFile(null)}
              testid="upload-ipa-dropzone" disabled={loading} showLimit limitMB={MAX_IPA_MB} />
          </motion.div>
        )}
        {isUrlMode && (
          <motion.div key="url" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">IPA URL <span className="text-red-400">*</span></label>
              <div className="relative">
                <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="url" value={ipaUrl} onChange={e => { setIpaUrl(e.target.value); setUploadErr(null); }}
                  placeholder="https://raw.githubusercontent.com/.../App.ipa" disabled={loading}
                  className="w-full h-11 pl-9 pr-4 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50 transition-shadow disabled:opacity-50 font-mono text-xs" />
              </div>
              <p className="text-xs text-muted-foreground">Paste a direct link to an .ipa file</p>
            </div>
          </motion.div>
        )}
        {isLibMode && (
          <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Recommended IPA Signers</p>
                <span className="text-xs text-muted-foreground">Select to auto-sign</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {appLibrary.map(app => (
                  <AppCard key={app.id} app={app} selected={selectedApp?.id === app.id} onSelect={handleSelectApp} />
                ))}
                {appLibrary.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-muted-foreground text-sm">
                    <Loader2 size={18} className="animate-spin mx-auto mb-2" />Loading library…
                  </div>
                )}
              </div>
              {selectedApp && (
                <div className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2.5 text-xs text-cyan-300">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span><strong>{selectedApp.name}</strong> selected. Provide your .p12 and .mobileprovision below.</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isFileMode && ipaOver && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <div className="flex items-start gap-2 text-red-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="font-semibold">This IPA is too big ({mbSize(ipaFile).toFixed(0)} MB / {MAX_IPA_MB} MB limit)</p>
          </div>
        </div>
      )}
      {isFileMode && ipaWarn && !ipaOver && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2.5 text-xs text-orange-300">
          <AlertCircle size={14} className="shrink-0" />
          Large IPA ({mbSize(ipaFile).toFixed(0)} MB) — upload may take a moment.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DropZone label="Certificate (.p12)" accept=".p12" icon={KeyRound}
          file={p12File} onFile={setP12File} onClear={() => setP12File(null)}
          testid="upload-p12-dropzone" disabled={loading} />
        <DropZone label="Provision Profile" accept=".mobileprovision" icon={FileCheck}
          file={provFile} onFile={setProvFile} onClear={() => setProvFile(null)}
          testid="upload-mobileprovision-dropzone" disabled={loading} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="sign-p12-password" className="text-sm font-medium text-foreground">
          Certificate Password <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input id="sign-p12-password" data-testid="signipa-password-input"
            type={showPassword ? 'text' : 'password'}
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Enter your certificate password" disabled={loading}
            className="w-full h-11 pl-9 pr-10 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/50 transition-shadow disabled:opacity-50" />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {uploadErr && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          <AlertCircle size={15} className="shrink-0" />{uploadErr}
        </div>
      )}

      <button type="submit" data-testid="signipa-submit-button"
        disabled={!canSubmit || loading || ipaOver}
        className="btn-primary-gradient w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
        {loading ? <><Loader2 size={16} className="animate-spin" />Uploading…</> : <><Shield size={16} />Sign IPA</>}
      </button>
      {!canSubmit && !loading && (
        <p className="text-xs text-center text-muted-foreground/70">
          {isLibMode && !selectedApp ? 'Select an app from the library above, then add certificate files' : 'Complete all fields above to continue'}
        </p>
      )}
    </form>
  );
}

const STEP_LABELS = ['Downloading / Uploading', 'Signing', 'Generating link', 'Done'];

function ProcessingView({ jobId, onSuccess, onError }) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('queued');
  const pollRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`);
        if (!res.ok) return;
        const job = await res.json();
        setStep(job.step || 0);
        setStatus(job.status);
        if (job.status === 'success') { clearInterval(pollRef.current); onSuccess(job); }
        else if (job.status === 'failed') { clearInterval(pollRef.current); onError(job.error || 'Signing failed.'); }
      } catch (_) {}
    };
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [jobId, onSuccess, onError]);

  const isDownloading = status === 'downloading';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <ProgressSteps step={step} />
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{isDownloading ? 'Downloading IPA…' : (STEP_LABELS[step] || 'Processing')}…</span>
            <span>{Math.round((step / (STEPS.length - 1)) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <motion.div className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, hsl(190 85% 52%), hsl(174 70% 40%))' }}
              initial={{ width: 0 }}
              animate={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin text-cyan-400" />
          {isDownloading ? 'Downloading IPA from URL, please wait…' : 'Signing in progress, do not close this page…'}
        </div>
      </div>
    </motion.div>
  );
}

export default function SignIpaPage() {
  const appLibrary = useAppLibrary();
  const [ipaFile, setIpaFile] = useState(null);
  const [p12File, setP12File] = useState(null);
  const [provFile, setProvFile] = useState(null);
  const [password, setPassword] = useState('');
  const [appState, setAppState] = useState('upload');
  const [jobId, setJobId] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleJobStarted = id => { setJobId(id); setAppState('processing'); };
  const handleSuccess = job => { setJobData(job); setAppState('success'); };
  const handleError = msg => { setErrorMsg(msg); setAppState('error'); };
  const handleRetry = () => { if (isPasswordError(errorMsg)) setPassword(''); setJobId(null); setErrorMsg(null); setAppState('upload'); };
  const handleFullReset = () => { setIpaFile(null); setP12File(null); setProvFile(null); setPassword(''); setJobId(null); setJobData(null); setErrorMsg(null); setAppState('upload'); };
  const isPasswordErr = isPasswordError(errorMsg);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
      {/* Header */}
      <div className="pt-8 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(34,211,238,0.18)', border: '1px solid rgba(34,211,238,0.3)' }}>
            <FileSignature size={16} style={{ color: 'hsl(190 85% 52%)' }} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>iOS SignTool</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: 'hsl(210 20% 98%)' }}>
          Sign &amp; Install iOS Apps
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          Upload, paste a URL, or pick from the app library — get an instant OTA install link.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {[
            { dot: 'bg-emerald-400', text: 'Files auto-deleted after 30 min' },
            { dot: 'bg-cyan-400', text: 'No account required' },
            { dot: 'bg-teal-400', text: 'Powered by zsign' },
          ].map((b, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80">
              <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />{b.text}
            </span>
          ))}
        </div>
      </div>

      {/* Main card */}
      <div className="glass-card p-5 sm:p-6">
        <AnimatePresence mode="wait">
          {appState === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2"><Upload size={16} style={{ color: 'hsl(190 85% 52%)' }} />Sign IPA</h2>
              <SignForm ipaFile={ipaFile} setIpaFile={setIpaFile} p12File={p12File} setP12File={setP12File}
                provFile={provFile} setProvFile={setProvFile} password={password} setPassword={setPassword}
                onJobStarted={handleJobStarted} appLibrary={appLibrary} />
            </motion.div>
          )}
          {appState === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2"><Loader2 size={16} style={{ color: 'hsl(190 85% 52%)' }} className="animate-spin" />Signing in Progress</h2>
              <ProcessingView jobId={jobId} onSuccess={handleSuccess} onError={handleError} />
            </motion.div>
          )}
          {appState === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" />Ready to Install</h2>
              <SuccessView job={jobData} onReset={handleFullReset} />
            </motion.div>
          )}
          {appState === 'error' && (
            <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2"><AlertCircle size={16} className="text-red-400" />{isPasswordErr ? 'Wrong Password' : 'Signing Failed'}</h2>
              <ErrorView error={errorMsg} isPasswordErr={isPasswordErr} onRetry={handleRetry} onFullReset={handleFullReset} appLibrary={appLibrary} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {appState === 'upload' && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Upload,     title: '1. Upload',  desc: 'File, raw URL, or pick from the App Library' },
            { icon: Shield,     title: '2. Sign',    desc: 'Re-signed with your certificate using zsign' },
            { icon: Smartphone, title: '3. Install', desc: 'Tap the install link on your iOS device' },
          ].map(item => (
            <div key={item.title} className="glass-card-sm p-4 space-y-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{ background: 'rgba(34,211,238,0.15)' }}>
                <item.icon size={14} style={{ color: 'hsl(190 85% 52%)' }} />
              </div>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
