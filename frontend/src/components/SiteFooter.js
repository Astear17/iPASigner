import React from 'react';

export default function SiteFooter() {
  return (
    <footer className="max-w-4xl mx-auto px-4 pb-10 pt-6 text-center" data-testid="site-footer">
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '20px' }}>
        <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
          Build and deployed by{' '}
          <a
            href="https://github.com/Astear17"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold transition-colors"
            style={{ color: 'hsl(158 83% 39%)' }}
          >
            Astear17
          </a>
        </p>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Trusted by{' '}
          <a
            href="https://khoindvn.io.vn"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold transition-colors"
            style={{ color: ‘hsl(190 85% 52%)’ }}
          >
            Khơindvn
          </a>
        </p>
      </div>
    </footer>
  );
}
