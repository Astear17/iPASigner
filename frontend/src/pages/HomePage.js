import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSignature, ShieldCheck, KeyRound, ArrowRight, Shield, Zap, Lock } from 'lucide-react';

const FEATURES = [
  {
    id: 'signipa',
    icon: FileSignature,
    accentColor: 'rgba(34,211,238,0.18)',
    borderColor: 'rgba(34,211,238,0.3)',
    iconColor: 'hsl(190 85% 52%)',
    title: 'Sign iPA',
    subtitle: 'Upload & Install',
    description:
      'Sign your iOS .ipa files with a P12 certificate and provisioning profile. Get an instant OTA install link — no Mac required.',
    features: ['Upload file, URL, or App Library', 'Instant OTA install link', 'QR code for easy install', 'Files auto-deleted after 30 min'],
    route: '/signipa',
    testid: 'home-feature-signipa-card',
  },
  {
    id: 'checkcert',
    icon: ShieldCheck,
    accentColor: 'rgba(52,211,153,0.15)',
    borderColor: 'rgba(52,211,153,0.3)',
    iconColor: 'hsl(160 84% 50%)',
    title: 'Check Certificate',
    subtitle: 'Validity & Info',
    description:
      'Inspect your P12 certificate and provisioning profile. View expiry dates, team info, entitlements, and all metadata at a glance.',
    features: ['Certificate details & expiry', 'Provisioning profile info', 'Entitlements breakdown', 'Wrong password detection'],
    route: '/checkcert',
    testid: 'home-feature-checkcert-card',
  },
  {
    id: 'certpass',
    icon: KeyRound,
    accentColor: 'rgba(251,191,36,0.12)',
    borderColor: 'rgba(251,191,36,0.3)',
    iconColor: 'hsl(43 96% 60%)',
    title: 'Change Cert Password',
    subtitle: 'P12 Password Changer',
    description:
      'Change your P12 certificate password online. Upload your cert bundle, set a new password, and download the updated ZIP instantly.',
    features: ['Separate files or ZIP upload', 'Download cert.p12 + mobileprovision', 'password.txt included in ZIP', 'No data stored server-side'],
    route: '/certpass',
    testid: 'home-feature-certpass-card',
  },
];

function FeatureCard({ feature }) {
  const navigate = useNavigate();
  return (
    <div
      className="glass-card p-6 flex flex-col"
      data-testid={feature.testid}
      style={{
        transition: 'transform 0.25s cubic-bezier(0.2,0,0.2,1), box-shadow 0.25s ease, border-color 0.2s ease',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 24px 70px rgba(0,0,0,0.55)';
        e.currentTarget.style.borderColor = feature.borderColor;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 18px 60px rgba(0,0,0,0.45)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
      }}
    >
      {/* Icon badge */}
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 flex-shrink-0"
        style={{ background: feature.accentColor, border: `1px solid ${feature.borderColor}` }}
      >
        <feature.icon size={22} style={{ color: feature.iconColor }} />
      </div>

      <div className="mb-1">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: feature.iconColor }}>
          {feature.subtitle}
        </span>
      </div>
      <h3 className="text-xl font-bold mb-2" style={{ color: 'hsl(210 20% 98%)' }}>
        {feature.title}
      </h3>
      <p className="text-sm leading-relaxed mb-4 flex-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
        {feature.description}
      </p>

      {/* Feature bullets */}
      <ul className="space-y-1.5 mb-6">
        {feature.features.map(f => (
          <li key={f} className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: feature.iconColor }}
            />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={() => navigate(feature.route)}
        data-testid={`home-cta-${feature.id}`}
        className="btn-primary-gradient w-full h-11 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold"
        style={{ background: `linear-gradient(135deg, ${feature.iconColor}, ${feature.accentColor.replace('0.18', '0.9').replace('0.15', '0.8').replace('0.12', '0.7')})` }}
      >
        Get Started <ArrowRight size={14} />
      </button>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
      {/* Hero */}
      <div className="pt-10 pb-12">
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(34,211,238,0.18)', border: '1px solid rgba(34,211,238,0.3)' }}
          >
            <Shield size={16} style={{ color: 'hsl(190 85% 52%)' }} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
            iOS Developer Tools
          </span>
        </div>

        <h1
          className="text-4xl sm:text-5xl font-bold tracking-tight mb-3"
          data-testid="home-hero-title"
          style={{ color: 'hsl(210 20% 98%)', lineHeight: 1.1 }}
        >
          iOS <span style={{ color: 'hsl(190 85% 52%)' }}>SignTool</span>
        </h1>
        <p className="text-base sm:text-lg max-w-2xl mb-6" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>
          Sign IPAs, validate certificates, and rotate P12 passwords — a complete iOS certificate
          management workspace. No Mac needed.
        </p>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center gap-4">
          {[
            { icon: Zap,    text: 'Instant processing' },
            { icon: Lock,   text: 'Certs never stored' },
            { icon: Shield, text: 'Powered by zsign' },
          ].map(b => (
            <div key={b.text} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <b.icon size={12} style={{ color: 'hsl(190 85% 52%)' }} />
              {b.text}
            </div>
          ))}
        </div>
      </div>

      {/* Feature cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {FEATURES.map(f => <FeatureCard key={f.id} feature={f} />)}
      </div>

      {/* Bottom CTA */}
      <div className="mt-12 glass-card-sm p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-base mb-1" style={{ color: 'hsl(210 20% 98%)' }}>Ready to sign your first IPA?</h3>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Start with Sign iPA — upload, sign, and install in under a minute.</p>
        </div>
        <button
          onClick={() => navigate('/signipa')}
          data-testid="home-primary-cta"
          className="btn-primary-gradient flex-shrink-0 h-11 px-6 rounded-2xl flex items-center gap-2 text-sm font-semibold"
        >
          Sign iPA Now <ArrowRight size={14} />
        </button>
      </div>
    </main>
  );
}
