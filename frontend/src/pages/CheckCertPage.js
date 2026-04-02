import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, KeyRound, FileCheck, Lock, Loader2, AlertCircle, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import DropZone from '../components/DropZone';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// ── Info row component ─────────────────────────────────────────────────────
function InfoRow({ label, value, copyable }) {
  const [copied, setCopied] = useState(false);
  const displayValue = Array.isArray(value)
    ? value.join(', ')
    : (value === null || value === undefined || value === '')
      ? <span style={{ color: 'rgba(255,255,255,0.2)' }}>(not set)</span>
      : String(value);

  const handleCopy = () => {
    const text = Array.isArray(value) ? value.join(', ') : String(value);
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="info-row">
      <span className="info-key">{label}</span>
      <div className="flex items-center gap-2">
        <span className="info-value" style={{ maxWidth: '260px' }}>{displayValue}</span>
        {copyable && typeof value === 'string' && value && (
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            {copied ? <Check size={11} className="text-teal-400" /> : <Copy size={11} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Validity badge ─────────────────────────────────────────────────────────
function ValidityBadge({ expiresAt }) {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft <= 0;
  const isWarn = daysLeft > 0 && daysLeft <= 30;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      data-testid="cert-status-text"
      style={{
        background: isExpired ? 'rgba(239,68,68,0.12)' : isWarn ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.12)',
        border: `1px solid ${isExpired ? 'rgba(239,68,68,0.4)' : isWarn ? 'rgba(251,191,36,0.4)' : 'rgba(52,211,153,0.4)'}`,
        color: isExpired ? 'hsl(0 72% 65%)' : isWarn ? 'hsl(43 96% 65%)' : 'hsl(160 84% 50%)',
      }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-400' : isWarn ? 'bg-yellow-400' : 'bg-emerald-400'}`} />
      {isExpired ? 'Expired' : isWarn ? `Expires in ${daysLeft} days` : `Valid • ${daysLeft} days left`}
    </span>
  );
}

// ── Section card ───────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, title, iconColor, accentColor, borderColor, children, testid }) {
  return (
    <div
      className="glass-card-sm p-5"
      data-testid={testid}
      style={{ borderColor: 'rgba(255,255,255,0.1)', marginBottom: '12px' }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: accentColor, border: `1px solid ${borderColor}` }}>
          <Icon size={14} style={{ color: iconColor }} />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Entitlement value renderer ─────────────────────────────────────────────
function EntitlementValue({ value }) {
  if (value === null || value === undefined) return <span style={{ color: 'rgba(255,255,255,0.2)' }}>(empty)</span>;
  if (typeof value === 'boolean') return <span className={value ? 'text-yellow-400' : 'text-teal-400'}>{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: 'rgba(255,255,255,0.2)' }}>(empty)</span>;
    return (
      <div className="flex flex-col gap-0.5" style={{ textAlign: 'right' }}>
        {value.map((v, i) => <span key={i} className="info-value text-xs" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{v}</span>)}
      </div>
    );
  }
  if (typeof value === 'object' && value.count !== undefined) {
    return (
      <div className="flex flex-col gap-0.5" style={{ textAlign: 'right' }}>
        {value.values.map((v, i) => <span key={i} className="info-value text-xs" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{v}</span>)}
      </div>
    );
  }
  return <span className="info-value">{String(value)}</span>;
}

// ── Results display ────────────────────────────────────────────────────────
function CertResults({ result }) {
  const { certificate, provisioning_profile, security, entitlements } = result;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-3"
      data-testid="checkcert-results"
    >
      {/* Certificate Info */}
      <SectionCard
        icon={ShieldCheck}
        title="Certificate Info"
        iconColor="hsl(190 85% 52%)"
        accentColor="rgba(34,211,238,0.15)"
        borderColor="rgba(34,211,238,0.3)"
        testid="cert-info-section"
      >
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <ValidityBadge expiresAt={certificate.expires_at} />
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}>
            {certificate.source}
          </span>
        </div>
        <InfoRow label="User ID"       value={certificate.user_id}      copyable />
        <InfoRow label="Common Name"   value={certificate.common_name}   copyable data-testid="cert-subject" />
        <InfoRow label="Country/Region" value={certificate.country}      />
        <InfoRow label="Organization"   value={certificate.organization} copyable />
        <InfoRow label="Org Unit"       value={certificate.org_unit}     copyable />
        <InfoRow label="Created At"     value={certificate.created_at}   />
        <InfoRow
          label="Expires At"
          value={certificate.expires_at}
        />
      </SectionCard>

      {/* Provisioning Profile */}
      <SectionCard
        icon={FileCheck}
        title="Provisioning Profile"
        iconColor="hsl(160 84% 50%)"
        accentColor="rgba(52,211,153,0.15)"
        borderColor="rgba(52,211,153,0.3)"
        testid="profile-info-section"
      >
        <div className="mb-3">
          <ValidityBadge expiresAt={provisioning_profile.expires_at} />
        </div>
        <InfoRow label="Name"            value={provisioning_profile.name}            copyable />
        <InfoRow label="UUID"            value={provisioning_profile.uuid}            copyable />
        <InfoRow label="Team Identifier" value={provisioning_profile.team_identifier} copyable />
        <InfoRow label="Team Name"       value={provisioning_profile.team_name}       />
        <InfoRow label="Profile Type"    value={provisioning_profile.profile_type}    />
        <InfoRow label="Created At"      value={provisioning_profile.created_at}      />
        <InfoRow label="Expires At"      value={provisioning_profile.expires_at}      />
      </SectionCard>

      {/* Security */}
      <SectionCard
        icon={Lock}
        title="Security"
        iconColor="hsl(43 96% 60%)"
        accentColor="rgba(251,191,36,0.12)"
        borderColor="rgba(251,191,36,0.3)"
        testid="security-info-section"
      >
        <InfoRow label="Certificate Password" value={security.password_display} />
      </SectionCard>

      {/* Entitlements */}
      <SectionCard
        icon={ShieldCheck}
        title={`Profile Entitlements`}
        iconColor="rgba(167,139,250,1)"
        accentColor="rgba(167,139,250,0.12)"
        borderColor="rgba(167,139,250,0.3)"
        testid="entitlements-section"
      >
        <div className="info-row">
          <span className="info-key">Application Identifier</span>
          <EntitlementValue value={entitlements.application_identifier} />
        </div>
        <div className="info-row">
          <span className="info-key">APS Environment</span>
          <EntitlementValue value={entitlements.aps_environment} />
        </div>
        <div className="info-row">
          <span className="info-key">Associated Domains</span>
          <EntitlementValue value={entitlements.associated_domains} />
        </div>
        <div className="info-row">
          <span className="info-key">Team Identifier</span>
          <EntitlementValue value={entitlements.team_identifier} />
        </div>
        <div className="info-row">
          <span className="info-key">Application Groups</span>
          <EntitlementValue value={entitlements.application_groups} />
        </div>
        <div className="info-row">
          <span className="info-key">Get Task Allow</span>
          <EntitlementValue value={entitlements.get_task_allow} />
        </div>
        <div className="info-row" style={{ borderBottom: 'none' }}>
          <span className="info-key">Keychain Access Groups</span>
          <EntitlementValue value={entitlements.keychain_access_groups} />
        </div>
      </SectionCard>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CheckCertPage() {
  const [p12File, setP12File]   = useState(null);
  const [mpFile,  setMpFile]    = useState(null);
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [result,   setResult]   = useState(null);

  const canSubmit = Boolean(p12File) && Boolean(mpFile);

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append('p12_file', p12File);
      fd.append('mobileprovision_file', mpFile);
      fd.append('password', password);

      const res = await fetch(`${BACKEND_URL}/api/check-cert`, { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) {
        const errMsg = data.detail || `Server error: ${res.status}`;
        // Detect wrong password specifically
        const isWrongPw = res.status === 401 || errMsg.toLowerCase().includes('password');
        setError({ message: errMsg, isWrongPassword: isWrongPw });
        return;
      }
      setResult(data);
      toast.success('Certificate parsed successfully');
    } catch (err) {
      setError({ message: err.message || 'Network error', isWrongPassword: false });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setP12File(null); setMpFile(null); setPassword(''); setError(null); setResult(null);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
      {/* Header */}
      <div className="pt-8 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>
            <ShieldCheck size={16} style={{ color: 'hsl(160 84% 50%)' }} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>iOS SignTool</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: 'hsl(210 20% 98%)' }}>
          Check Certificate Validity
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          Inspect your P12 certificate and provisioning profile. View expiry dates, team info, and entitlements.
        </p>
      </div>

      {/* Form Card */}
      <div className="glass-card p-5 sm:p-6 mb-5">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <ShieldCheck size={16} style={{ color: 'hsl(160 84% 50%)' }} />
          Upload Certificate Files
        </h2>

        <form onSubmit={handleCheck} className="space-y-4" data-testid="checkcert-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DropZone
              label="Certificate (.p12)"
              accept=".p12"
              icon={KeyRound}
              file={p12File}
              onFile={f => { setP12File(f); setError(null); setResult(null); }}
              onClear={() => { setP12File(null); setResult(null); }}
              testid="upload-p12-dropzone"
              disabled={loading}
            />
            <DropZone
              label="Provisioning Profile"
              accept=".mobileprovision"
              icon={FileCheck}
              file={mpFile}
              onFile={f => { setMpFile(f); setError(null); setResult(null); }}
              onClear={() => { setMpFile(null); setResult(null); }}
              testid="upload-mobileprovision-dropzone"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="check-password" className="text-sm font-medium text-foreground">
              Certificate Password
              <span className="ml-2 text-xs text-muted-foreground font-normal">(required to read certificate)</span>
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                id="check-password"
                data-testid="checkcert-password-input"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null); }}
                placeholder="Enter certificate password"
                disabled={loading}
                className="w-full h-11 pl-9 pr-10 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/50 transition-shadow disabled:opacity-50"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Wrong password / error banner */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`rounded-xl border p-4 ${
                  error.isWrongPassword
                    ? 'border-orange-500/40 bg-orange-500/10'
                    : 'border-red-500/40 bg-red-500/10'
                }`}>
                <div className="flex items-start gap-3">
                  <AlertCircle size={17} className={error.isWrongPassword ? 'text-orange-400' : 'text-red-400'} />
                  <div>
                    <p className={`font-semibold text-sm mb-0.5 ${error.isWrongPassword ? 'text-orange-300' : 'text-red-300'}`}>
                      {error.isWrongPassword ? 'Wrong Certificate Password' : 'Error'}
                    </p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{error.message}</p>
                    {error.isWrongPassword && (
                      <p className="text-xs mt-1.5 text-orange-200/70">Double-check the password — it’s case-sensitive. You can still view the provisioning profile without it.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            data-testid="checkcert-submit-button"
            disabled={!canSubmit || loading}
            className="btn-primary-gradient w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{ background: 'linear-gradient(135deg, hsl(160 84% 42%), hsl(190 85% 45%))' }}
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin" />Checking…</>
              : <><ShieldCheck size={16} />Check Certificate</>
            }
          </button>
        </form>
      </div>

      {/* Results */}
      <AnimatePresence>
        {result && <CertResults result={result} />}
      </AnimatePresence>

      {result && (
        <button
          onClick={handleReset}
          className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Check another certificate
        </button>
      )}
    </main>
  );
}
