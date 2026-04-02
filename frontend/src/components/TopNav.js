import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Shield, Menu, X, Home, FileSignature, ShieldCheck, KeyRound } from 'lucide-react';
import { useState } from 'react';

const NAV_LINKS = [
  { label: 'Home',         href: '/',          icon: Home,          testid: 'nav-home-link' },
  { label: 'Sign iPA',     href: '/signipa',    icon: FileSignature, testid: 'nav-signipa-link' },
  { label: 'Check Cert',   href: '/checkcert',  icon: ShieldCheck,   testid: 'nav-checkcert-link' },
  { label: 'Cert Pass',    href: '/certpass',   icon: KeyRound,      testid: 'nav-certpass-link' },
];

export default function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Fixed pill header */}
      <header
        className="glass-header fixed top-3 left-1/2 z-50 flex items-center justify-between px-4 sm:px-6"
        style={{
          transform: 'translateX(-50%)',
          width: 'min(960px, calc(100% - 1.5rem))',
          height: '52px',
          borderRadius: '999px',
        }}
      >
        {/* Brand */}
        <NavLink to="/" className="flex items-center gap-2 flex-shrink-0" data-testid="nav-brand">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(34,211,238,0.18)', border: '1px solid rgba(34,211,238,0.3)' }}>
            <Shield size={14} style={{ color: 'hsl(190 85% 52%)' }} />
          </div>
          <span className="font-bold text-sm tracking-tight" style={{ color: 'hsl(210 20% 98%)' }}>
            iOS <span style={{ color: 'hsl(190 85% 52%)' }}>SignTool</span>
          </span>
        </NavLink>

        {/* Desktop nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.href}
              to={link.href}
              data-testid={link.testid}
              end={link.href === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'nav-link-active'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`
              }
            >
              <link.icon size={12} />
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile menu button */}
        <button
          className="sm:hidden p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          data-testid="nav-mobile-menu-btn"
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div
          className="fixed top-20 left-1/2 z-40 w-[min(320px,calc(100%-1.5rem))] glass-card p-3"
          style={{ transform: 'translateX(-50%)', borderRadius: '20px' }}
          data-testid="nav-mobile-menu"
        >
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.href}
              to={link.href}
              end={link.href === '/'}
              onClick={() => setMenuOpen(false)}
              data-testid={`nav-mobile-${link.testid}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'nav-link-active'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`
              }
            >
              <link.icon size={15} />
              {link.label}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}
