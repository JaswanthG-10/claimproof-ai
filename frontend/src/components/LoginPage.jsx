import React, { useEffect } from 'react';
import { Shield, ArrowRight, CheckCircle2, Lock, Cpu, Sparkles } from 'lucide-react';
import NeuralNetworkSvg from './NeuralNetworkSvg';

export default function LoginPage({ onEnter }) {
  // Listen for Enter key press to quickly enter the workspace
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        onEnter();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEnter]);

  return (
    <div className="relative min-h-screen w-full bg-[#080c18] text-[#e2e8f0] flex flex-col justify-between items-center p-4 sm:p-6 overflow-hidden select-none">
      
      {/* 1. BACKGROUND FLOATING GRADIENT ORBS */}
      <div className="absolute top-[-10%] left-[-5%] w-[450px] h-[450px] rounded-full bg-radial from-[#4f76c8]/25 via-[#4f76c8]/10 to-transparent blur-[110px] animate-orb-1 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[550px] h-[550px] rounded-full bg-radial from-[#7c5cbf]/25 via-[#7c5cbf]/08 to-transparent blur-[130px] animate-orb-2 pointer-events-none" />
      <div className="absolute top-[40%] right-[15%] w-[320px] h-[320px] rounded-full bg-radial from-[#3b82f6]/15 to-transparent blur-[90px] animate-orb-3 pointer-events-none" />

      {/* 2. SUBTLE GRID OVERLAY FOR DEPTH */}
      <div className="absolute inset-0 grid-overlay pointer-events-none" />

      {/* 3. ANIMATED NEURAL NETWORK SVG LAYER */}
      <NeuralNetworkSvg />

      {/* 4. 3D SPINNING RINGS & FLOATING GEOMETRIC SHAPES */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        {/* 3D Spinning Ring 1 */}
        <div className="w-[580px] h-[580px] rounded-full border border-[#4f76c8]/15 animate-ring-1 opacity-70" />
        {/* 3D Spinning Ring 2 */}
        <div className="absolute w-[460px] h-[460px] rounded-full border border-[#7c5cbf]/20 animate-ring-2 opacity-60" />

        {/* Floating Geometric: Triangle */}
        <div className="absolute top-[18%] left-[12%] animate-geo-float opacity-40 hover:opacity-80 transition-opacity">
          <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
            <polygon points="21,4 38,36 4,36" stroke="#4f76c8" strokeWidth="1.5" fill="rgba(79, 118, 200, 0.05)" />
          </svg>
        </div>

        {/* Floating Geometric: Hexagon */}
        <div className="absolute bottom-[22%] left-[18%] animate-geo-float opacity-35" style={{ animationDelay: '3s' }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <polygon points="18,3 32,10 32,26 18,33 4,26 4,10" stroke="#7c5cbf" strokeWidth="1.5" fill="rgba(124, 92, 191, 0.06)" />
          </svg>
        </div>

        {/* Floating Geometric: Dot Cluster */}
        <div className="absolute top-[28%] right-[14%] flex gap-2.5 animate-geo-float opacity-40" style={{ animationDelay: '1.5s' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-[#4f76c8] shadow-[0_0_8px_#4f76c8]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#7c5cbf] shadow-[0_0_8px_#7c5cbf]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#e2e8f0]" />
        </div>

        {/* Floating Geometric: Small Hexagon right */}
        <div className="absolute bottom-[26%] right-[18%] animate-geo-float opacity-30" style={{ animationDelay: '4.5s' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <polygon points="16,2 29,9 29,23 16,30 3,23 3,9" stroke="#4f76c8" strokeWidth="1.2" />
          </svg>
        </div>
      </div>

      {/* 5. TOP BRAND PILL */}
      <header className="relative z-10 w-full max-w-6xl flex justify-between items-center py-2">
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0e1528]/80 border border-white/10 backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse shadow-[0_0_8px_#10b981]" />
          <span className="text-xs font-medium text-[#94a3b8] tracking-wide">Autonomous Claim Engine v2.4</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-[#94a3b8]">
          <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#4f76c8]" /> IRDAI Compliant</span>
          <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-[#7c5cbf]" /> Grounded AI Audit</span>
        </div>
      </header>

      {/* 6. CENTER HERO CARD (GLASSMORPHISM) */}
      <main className="relative z-10 my-auto w-full max-w-md flex flex-col items-center">
        <div className="relative w-full rounded-3xl p-[1px] bg-gradient-to-b from-white/15 via-white/5 to-white/0 shadow-2xl backdrop-blur-2xl">
          <div className="w-full rounded-3xl bg-[#0e1528]/85 p-7 sm:p-9 flex flex-col items-center text-center border border-white/10">
            
            {/* SHIELD LOGO WITH ROTATING CONIC BORDER & PULSE RINGS */}
            <div className="relative mb-6 flex items-center justify-center">
              {/* Radar Pulse Rings */}
              <div className="absolute w-24 h-24 rounded-full border border-[#4f76c8]/30 animate-radar-1" />
              <div className="absolute w-28 h-28 rounded-full border border-[#7c5cbf]/25 animate-radar-2" />
              
              {/* Rotating Conic Border Wrapper */}
              <div className="relative w-18 h-18 rounded-2xl p-[2px] overflow-hidden flex items-center justify-center shadow-lg shadow-[#4f76c8]/20">
                <div 
                  className="absolute inset-[-50%] animate-conic"
                  style={{
                    background: 'conic-gradient(from 0deg, #4f76c8, #7c5cbf, #10b981, #4f76c8)'
                  }}
                />
                <div className="relative w-full h-full rounded-[14px] bg-[#0e1528] flex items-center justify-center">
                  <Shield className="w-8 h-8 text-[#e2e8f0] fill-[#4f76c8]/20" />
                </div>
              </div>
            </div>

            {/* LARGE BOLD HEADING WITH SLOW SHIMMER GRADIENT */}
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2.5">
              <span className="animate-shimmer">ClaimProofAI</span>
            </h1>

            {/* ONE-LINE MOTOR INSURANCE TAGLINE */}
            <p className="text-sm sm:text-base text-[#94a3b8] font-normal leading-relaxed mb-7 max-w-xs">
              AI-driven evidence review and instant policy eligibility verification for motor insurance claims.
            </p>

            {/* FEATURES CHIPS */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#111a33] text-[#94a3b8] border border-white/5">
                Instant Verification
              </span>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#111a33] text-[#94a3b8] border border-white/5">
                Contradiction Detection
              </span>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#111a33] text-[#94a3b8] border border-white/5">
                Policy Grounded
              </span>
            </div>

            {/* "ENTER WORKSPACE" CTA BUTTON */}
            <button
              onClick={onEnter}
              className="group relative w-full py-3.5 px-6 rounded-xl font-semibold text-white tracking-wide overflow-hidden shadow-lg shadow-[#4f76c8]/25 hover:shadow-xl hover:shadow-[#7c5cbf]/35 transition-all duration-300 active:scale-[0.98] cursor-pointer"
            >
              {/* Gradient fill */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#4f76c8] to-[#7c5cbf] transition-all duration-300 group-hover:opacity-95" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#7c5cbf] to-[#4f76c8] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Button content */}
              <div className="relative flex items-center justify-center gap-2.5 text-sm sm:text-base">
                <span>Enter Workspace</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
              </div>
            </button>

            {/* PRESS ENTER KEY INDICATOR */}
            <div className="mt-4 flex items-center gap-2 text-xs text-[#94a3b8]/70">
              <span>Press</span>
              <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-[#111a33] border border-white/10 text-[#e2e8f0]">
                Enter ↵
              </kbd>
              <span>to navigate</span>
            </div>

            {/* ZERO CREDENTIAL NOTICE */}
            <div className="mt-5 pt-4 border-t border-white/5 w-full flex items-center justify-center gap-1.5 text-[11px] text-[#94a3b8]/60">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
              <span>No credentials required · Instant policyholder sandbox</span>
            </div>

          </div>
        </div>
      </main>

      {/* 7. FOOTER */}
      <footer className="relative z-10 w-full max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 py-4 text-xs text-[#94a3b8]/70 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
          </span>
          <span className="font-medium text-[#e2e8f0]/80">Secure · Encrypted · Always on</span>
        </div>
        <div>
          <span>ClaimProofAI Motor Insurance Framework · IRDAI Guidelines Aligned</span>
        </div>
      </footer>

    </div>
  );
}
