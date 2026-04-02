import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SignIpaPage from './pages/SignIpaPage';
import CheckCertPage from './pages/CheckCertPage';
import CertPassPage from './pages/CertPassPage';
import TopNav from './components/TopNav';
import SiteFooter from './components/SiteFooter';
import { Toaster } from './components/ui/sonner';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-container app-noise">
        <div className="gradient-overlay" />
        <TopNav />
        <div className="content-layer pt-20">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/signipa" element={<SignIpaPage />} />
            <Route path="/checkcert" element={<CheckCertPage />} />
            <Route path="/certpass" element={<CertPassPage />} />
          </Routes>
          <SiteFooter />
        </div>
        <Toaster position="bottom-right" richColors />
      </div>
    </BrowserRouter>
  );
}
