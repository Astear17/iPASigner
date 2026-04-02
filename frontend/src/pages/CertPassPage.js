import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyRound, FileCheck, Lock, Loader2, AlertCircle, Eye, EyeOff,
  Download, CheckCircle2, RefreshCw, Archive
} from 'lucide-react';
import { toast } from 'sonner';
import DropZone from '../components/DropZone';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const MODES = [
  { id: 'separate', label: 'Separate Files', icon: FileCheck },
  { id: 'zip',      label: 'ZIP Bundle',     icon: Archive },
];

function ModeTab({ modes, active, onChange }) {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl mb-5"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      data-testid="certpass-mode-tabs"
    >
      {modes.map(m => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-semibold transition-colors ${
            active === m.id
              ? 'bg-white/8 text-foreground border border-white/12'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <m.icon size={12} />
          {m.label}
        </button>
      ))}
    </div>
  );
}

export default function CertPassPage() {
  const [mode, setMode]         = useState('separate');
  const [p12File, setP12File]   = useState(null);
  const [mpFile, setMpFile]     = useState(null);
  const [zipFile, setZipFile]   = useState(null);
  const [oldPass, setOldPass]   = useState('');
  const [newPass, setNewPass]   = useState('');
  const [showOld, setShowOld]   = useState(false);
  const [showNew, setShowNew]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState(false);

  const isSeparate = mode === 'separate';
  const canSubmit = isSeparate
    ? Boolean(p12File) && Boolean(mpFile) && Boolean(newPass.trim())
    : Boolean(zipFile) && Boolean(newPass.trim());

  const handleModeChange = (m) => {
    setMode(m); setError(null); setSuccess(false);
    setP12File(null); setMpFile(null); setZipFile(null);
    setOldPass(''); setNewPass('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const fd = new FormData();
      fd.append('old_password', oldPass);
      fd.append('new_password', newPass);

      if (isSeparate) {
        fd.append('p12_file', p12File);
        fd.append('mobileprovision_file', mpFile);
      } else {
        fd.append('bundle_zip', zipFile);
      }

      const res = await fetch(`${BACKEND_URL}/api/change-cert-password`, { method: 'POST', body: fd });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errMsg = data.detail || `Server error: ${res.status}`;
        const isWrongPw = res.status === 401 || errMsg.toLowerCase().includes('password');
        setError({ message: errMsg, isWrongPassword: isWrongPw });
        return;
      }

      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ios_cert_bundle.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(true);
      toast.success('Certificate bundle downloaded!');
    } catch (err) {
      setError({ message: err.message || 'Network error', isWrongPassword: false });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setP12File(null); setMpFile(null); setZipFile(null);
    setOldPass(''); setNewPass('');
    setError(null); setSuccess(false);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
      {/* Header */}
      <div className="pt-8 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>
            <KeyRound size={16} style={{ color: 'hsl(43 96% 60%)' }} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>iOS SignTool</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: 'hsl(210 20% 98%)' }}>
          Change Cert Password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          Change your P12 certificate password. Download a ZIP bundle with
          cert.p12, cert.mobileprovision, and password.txt.
        </p>
      </div>

      {/* Main form card */}
      <div className="glass-card p-5 sm:p-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <KeyRound size={16} style={{ color: 'hsl(43 96% 60%)' }} />
          Certificate Bundle
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Mode tabs */}
          <ModeTab modes={MODES} active={mode} onChange={handleModeChange} />

          {/* File inputs */}
          <AnimatePresence mode="wait">
            {isSeparate ? (
              <motion.div key="separate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DropZone
                    label="Certificate (.p12)"
                    accept=".p12"
                    icon={KeyRound}
                    file={p12File}
                    onFile={f => { setP12File(f); setError(null); setSuccess(false); }}
                    onClear={() => setP12File(null)}
                    testid="upload-p12-dropzone"
                    disabled={loading}
                  />
                  <DropZone
                    label="Provisioning Profile"
                    accept=".mobileprovision"
                    icon={FileCheck}
                    file={mpFile}
                    onFile={f => { setMpFile(f); setError(null); setSuccess(false); }}
                    onClear={() => setMpFile(null)}
                    testid="upload-mobileprovision-dropzone"
                    disabled={loading}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div key="zip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <DropZone
                  label="ZIP Bundle (containing .p12 + .mobileprovision)"
                  accept=".zip"
                  icon={Archive}
                  file={zipFile}
                  onFile={f => { setZipFile(f); setError(null); setSuccess(false); }}
                  onClear={() => setZipFile(null)}
                  testid="upload-zip-dropzone"
                  disabled={loading}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  The ZIP must contain a <code className="font-mono">.p12</code> and a <code className="font-mono">.mobileprovision</code> file.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Passwords */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="old-password" className="text-sm font-medium text-foreground">
                Old Password
                <span className="ml-2 text-xs text-muted-foreground font-normal">(leave blank if none)</span>
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="old-password"
                  data-testid="certpass-old-password"
                  type={showOld ? 'text' : 'password'}
                  value={oldPass}
                  onChange={e => { setOldPass(e.target.value); setError(null); }}
                  placeholder="Current password"
                  disabled={loading}
                  className="w-full h-11 pl-9 pr-10 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
                />
                <button type="button" onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium text-foreground">
                New Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="new-password"
                  data-testid="certpass-new-password"
                  type={showNew ? 'text' : 'password'}
                  value={newPass}
                  onChange={e => { setNewPass(e.target.value); setError(null); }}
                  placeholder="New password"
                  disabled={loading}
                  className="w-full h-11 pl-9 pr-10 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`rounded-xl border p-4 ${
                  error.isWrongPassword ? 'border-orange-500/40 bg-orange-500/10' : 'border-red-500/40 bg-red-500/10'
                }`}>
                <div className="flex items-start gap-3">
                  <AlertCircle size={17} className={error.isWrongPassword ? 'text-orange-400' : 'text-red-400'} />
                  <div>
                    <p className={`font-semibold text-sm mb-0.5 ${error.isWrongPassword ? 'text-orange-300' : 'text-red-300'}`}>
                      {error.isWrongPassword ? 'Wrong Old Password' : 'Error'}
                    </p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{error.message}</p>
                    {error.isWrongPassword && (
                      <p className="text-xs mt-1.5 text-orange-200/70">The old password is case-sensitive. Try re-entering it carefully.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            data-testid="certpass-submit-button"
            disabled={!canSubmit || loading}
            className="btn-primary-gradient w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{ background: 'linear-gradient(135deg, hsl(43 96% 50%), hsl(30 85% 50%))' }}
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin" />Processing…</>
              : <><Download size={16} />Change Password &amp; Download ZIP</>
            }
          </button>
        </form>
      </div>

      {/* Success card */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-5 glass-card-sm p-5"
            data-testid="certpass-result"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>
                <CheckCircle2 size={18} style={{ color: 'hsl(160 84% 50%)' }} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'hsl(160 84% 50%)' }}>Download Complete</p>
                <p className="text-xs text-muted-foreground">Your certificate bundle has been downloaded.</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { file: 'cert.p12', desc: 'Re-encrypted P12 certificate with new password' },
                { file: 'cert.mobileprovision', desc: 'Original provisioning profile (unchanged)' },
                { file: 'password.txt', desc: 'New password in plain text for reference' },
              ].map(item => (
                <div key={item.file} className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <CheckCircle2 size={14} className="text-teal-400 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-mono font-semibold" style={{ color: 'hsl(210 20% 92%)' }}>{item.file}</span>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleReset}
              className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <RefreshCw size={13} />Change another certificate
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info section */}
      {!success && (
        <div className="mt-6 glass-card-sm p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>What’s included in the download?</h3>
          <div className="space-y-2">
            {[
              { file: 'cert.p12',            desc: 'Your certificate re-encrypted with the new password' },
              { file: 'cert.mobileprovision', desc: 'The provisioning profile (copied unchanged)' },
              { file: 'password.txt',         desc: 'The new password saved as plain text' },
            ].map(item => (
              <div key={item.file} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'hsl(43 96% 60%)' }} />
                <div>
                  <span className="text-xs font-mono font-semibold" style={{ color: 'hsl(210 20% 88%)' }}>{item.file}</span>
                  <span className="text-xs text-muted-foreground ml-2">— {item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
