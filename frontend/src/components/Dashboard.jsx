import React, { useState } from 'react';
import { 
  Shield, Home, FileText, FolderCheck, BookOpen, Clock, Settings, LogOut, 
  Search, Bell, Plus, ArrowUpRight, CheckCircle, AlertTriangle, AlertCircle, 
  XCircle, ChevronRight, UploadCloud, FileBadge, SearchCheck, Download, 
  Car, Calendar, DollarSign, ArrowRight, Sparkles, Filter
} from 'lucide-react';
import { MOCK_CLAIMS, STATS, NOTIFICATIONS, POLICY_SUMMARY } from '../data/mockData';

export default function Dashboard({ onSignOut, onSelectClaim, onStartClaim, onOpenSearch, onOpenUpload }) {
  const [activeTab, setActiveTab] = useState('Home');
  const [showNotifications, setShowNotifications] = useState(false);
  const [claimsFilter, setClaimsFilter] = useState('ALL');

  const filteredClaims = MOCK_CLAIMS.filter(claim => {
    if (claimsFilter === 'ALL') return true;
    if (claimsFilter === 'APPROVED') return claim.status === 'Approved';
    if (claimsFilter === 'ACTION') return claim.status === 'Action Required';
    if (claimsFilter === 'REVIEW') return claim.status === 'Under Review';
    return true;
  });

  const getStatusBadgeClass = (statusBadge) => {
    switch (statusBadge) {
      case 'approved':
        return 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30';
      case 'warning':
        return 'bg-[#d97706]/15 text-[#f59e0b] border-[#d97706]/30';
      case 'escalated':
        return 'bg-[#06b6d4]/15 text-[#06b6d4] border-[#06b6d4]/30';
      case 'rejected':
        return 'bg-[#e11d48]/15 text-[#f43f5e] border-[#e11d48]/30';
      default:
        return 'bg-[#4f76c8]/15 text-[#4f76c8] border-[#4f76c8]/30';
    }
  };

  const getProgressBarColor = (statusBadge) => {
    switch (statusBadge) {
      case 'approved': return 'bg-[#10b981]';
      case 'warning': return 'bg-[#f59e0b]';
      case 'escalated': return 'bg-[#06b6d4]';
      case 'rejected': return 'bg-[#f43f5e]';
      default: return 'bg-[#4f76c8]';
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#080c18] text-[#e2e8f0] flex overflow-hidden">
      
      {/* BACKGROUND AMBIENT ORBS */}
      <div className="fixed top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-radial from-[#4f76c8]/15 via-transparent to-transparent blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full bg-radial from-[#7c5cbf]/15 via-transparent to-transparent blur-[160px] pointer-events-none" />
      <div className="fixed inset-0 grid-overlay pointer-events-none opacity-40" />

      {/* 1. LEFT SIDEBAR */}
      <aside className="relative z-20 w-64 shrink-0 bg-[#0e1528]/80 backdrop-blur-xl border-r border-white/10 flex flex-col justify-between hidden md:flex">
        <div>
          {/* Brand Logo Header */}
          <div className="p-5 flex items-center gap-3 border-b border-white/5">
            <div className="relative w-9 h-9 rounded-xl p-[1.5px] overflow-hidden flex items-center justify-center">
              <div 
                className="absolute inset-[-50%] animate-conic"
                style={{ background: 'conic-gradient(from 0deg, #4f76c8, #7c5cbf, #4f76c8)' }}
              />
              <div className="relative w-full h-full rounded-[10px] bg-[#0e1528] flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#e2e8f0]" />
              </div>
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                ClaimProof<span className="text-[#4f76c8]">AI</span>
              </div>
              <div className="text-[11px] text-[#94a3b8] font-medium tracking-wide">Smart Claim Checker</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-[#94a3b8]/60 uppercase tracking-wider">
              Main Menu
            </div>
            
            {[
              { id: 'Home', label: 'Home', icon: Home },
              { id: 'My Claims', label: 'My Claims', icon: FileText, badge: '4' },
              { id: 'Documents', label: 'Documents', icon: FolderCheck, badge: '8' },
              { id: 'My Policy', label: 'My Policy', icon: BookOpen },
              { id: 'Tracking', label: 'Tracking', icon: Clock },
              { id: 'Account', label: 'Account', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#4f76c8]/20 to-[#7c5cbf]/15 text-white border border-[#4f76c8]/30 shadow-sm'
                      : 'text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#4f76c8]' : 'text-[#94a3b8]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-[#162244] text-[#94a3b8] border border-white/5">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Policy IDV Mini-Card & Sign Out */}
        <div className="p-4 border-t border-white/5 space-y-3">
          {/* Policy summary widget */}
          <div className="p-3 rounded-xl bg-[#111a33]/60 border border-white/5">
            <div className="flex items-center justify-between text-[11px] text-[#94a3b8] mb-1.5">
              <span>Remaining IDV</span>
              <span className="font-mono text-[#10b981] font-semibold">₹7,51,250</span>
            </div>
            {/* Progress meter */}
            <div className="w-full h-1.5 rounded-full bg-[#080c18] overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#4f76c8] to-[#10b981] w-[93%]" />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-[#94a3b8]/60 font-mono">
              <span>POL-2026-104</span>
              <span>Total: ₹8.0L</span>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#94a3b8] hover:text-[#f43f5e] hover:bg-[#f43f5e]/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 h-16 bg-[#080c18]/85 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 flex items-center justify-between gap-4">
          
          {/* Left: Breadcrumb */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-[#94a3b8]">
            <span className="text-[#e2e8f0] font-semibold">ClaimProofAI</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>{activeTab}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#4f76c8] font-mono">TN00DM2026</span>
          </div>

          {/* Right: Search, Notifications, Avatar */}
          <div className="flex items-center gap-3">
            {/* Search input button */}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-[#0e1528] border border-white/10 text-xs text-[#94a3b8] hover:border-[#4f76c8]/40 hover:text-[#e2e8f0] transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search claims, RC, FIR...</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] font-mono bg-[#162244] border border-white/10 rounded text-[#e2e8f0]">
                ⌘K
              </kbd>
            </button>

            {/* Notification Bell with Amber Dot */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl bg-[#0e1528] border border-white/10 text-[#94a3b8] hover:text-[#e2e8f0] hover:border-white/20 transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#f59e0b] ring-2 ring-[#080c18]" />
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#0e1528] border border-white/10 shadow-2xl p-3 z-50 backdrop-blur-2xl">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5 px-1">
                    <span className="text-xs font-semibold text-white">Notifications</span>
                    <span className="text-[10px] font-mono text-[#4f76c8]">2 Unread</span>
                  </div>
                  <div className="space-y-2">
                    {NOTIFICATIONS.map((n) => (
                      <div key={n.id} className="p-2 rounded-lg bg-[#111a33]/60 border border-white/5 text-xs hover:bg-[#162244] transition-colors">
                        <div className="font-semibold text-[#e2e8f0] flex items-center justify-between">
                          <span>{n.title}</span>
                          <span className="text-[10px] text-[#94a3b8] font-normal">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-[#94a3b8] mt-1 leading-snug">{n.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar with Initials */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#4f76c8] to-[#7c5cbf] flex items-center justify-center font-bold text-xs text-white shadow-md">
                JG
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-white">Jaswanth G</div>
                <div className="text-[10px] text-[#94a3b8]">Policyholder</div>
              </div>
            </div>

          </div>
        </header>

        {/* 3. DASHBOARD MAIN BODY */}
        <main className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
          
          {/* A. WELCOME BANNER */}
          <div className="relative rounded-3xl p-6 sm:p-8 overflow-hidden bg-gradient-to-r from-[#111a33]/90 via-[#162244]/80 to-[#14122b]/90 border border-white/10 shadow-xl backdrop-blur-xl">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4f76c8]/15 border border-[#4f76c8]/30 text-xs font-medium text-[#4f76c8]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Real-time Policy Intelligence Active</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Welcome back, <span className="animate-shimmer">Jaswanth</span>
                </h2>
                <p className="text-sm text-[#94a3b8] max-w-xl leading-relaxed">
                  Your motor insurance policy <strong className="text-[#e2e8f0]">POL-2026-104</strong> is active. 
                  ClaimProofAI detected 1 claim requiring attention to finalize evidence review.
                </p>
              </div>

              {/* Start New Claim Button */}
              <button
                onClick={onStartClaim}
                className="shrink-0 flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-[#4f76c8] to-[#7c5cbf] hover:from-[#5a82db] hover:to-[#8c6ad1] text-white text-sm font-semibold shadow-lg shadow-[#4f76c8]/25 hover:shadow-xl transition-all duration-300 active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Start New Claim</span>
              </button>
            </div>
          </div>

          {/* B. STATS ROW (4 CARDS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((stat, idx) => (
              <div
                key={idx}
                className="glass-card rounded-2xl p-5 hover:-translate-y-1 transition-transform duration-300 cursor-default"
              >
                <div className="flex items-center justify-between text-xs text-[#94a3b8] mb-3">
                  <span>{stat.title}</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/5 text-[#e2e8f0]">
                    2026
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">
                  {stat.value}
                </div>
                <div className="text-xs font-medium text-[#94a3b8] flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    stat.color === 'emerald' ? 'bg-[#10b981]' :
                    stat.color === 'amber' ? 'bg-[#f59e0b]' :
                    stat.color === 'violet' ? 'bg-[#7c5cbf]' : 'bg-[#4f76c8]'
                  }`} />
                  <span>{stat.subtext}</span>
                </div>
              </div>
            ))}
          </div>

          {/* C. TWO-COLUMN SECTION (CURRENT CLAIM + 2X2 ACTIONS) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Current Claim Card (Amber Glow Border) */}
            <div className="lg:col-span-7 rounded-3xl p-6 bg-[#0e1528]/80 border-2 border-[#d97706]/40 shadow-xl shadow-[#d97706]/5 backdrop-blur-xl flex flex-col justify-between hover:border-[#d97706]/60 transition-colors">
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-[#4f76c8] bg-[#4f76c8]/15 px-2.5 py-1 rounded-lg border border-[#4f76c8]/30">
                      CLM-2026-002
                    </span>
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#d97706]/20 text-[#f59e0b] border border-[#d97706]/30">
                      Action Required
                    </span>
                  </div>
                  <span className="text-xs font-mono text-[#94a3b8]">Incident: 2026-08-28</span>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">
                  Side Impact Collision Damage
                </h3>
                <p className="text-xs text-[#94a3b8] mb-4">
                  Vehicle: <strong className="text-[#e2e8f0]">TN00DM2026</strong> (Maruti Suzuki Swift Dzire) · Estimated: <strong className="text-[#e2e8f0]">₹72,000</strong>
                </p>

                {/* Readiness Progress Bar */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#94a3b8]">Claim Readiness Score</span>
                    <span className="font-mono font-bold text-[#f59e0b]">78% Complete</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#111a33] overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#4f76c8] to-[#f59e0b] w-[78%] rounded-full transition-all duration-500" />
                  </div>
                </div>

                {/* Missing Document Alert Box */}
                <div className="p-3.5 rounded-xl bg-[#d97706]/10 border border-[#d97706]/30 flex items-start gap-3 text-xs mb-5">
                  <AlertTriangle className="w-4 h-4 text-[#f59e0b] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[#f59e0b]">Driving Licence Document Missing</div>
                    <div className="text-[#94a3b8] mt-0.5">
                      Required to verify driver licensing validity under Policy Clause 5.1 before payout clearance.
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-xs text-[#94a3b8]">3 of 4 documents verified</span>
                <button
                  onClick={() => onSelectClaim(MOCK_CLAIMS[1])}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-[#080c18] font-bold text-xs tracking-wide transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <span>Continue Claim</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Column: 2x2 Quick Action Grid */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4">
              
              <button
                onClick={onOpenUpload}
                className="glass-card rounded-2xl p-4 text-left hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#4f76c8]/15 border border-[#4f76c8]/30 flex items-center justify-center text-[#4f76c8] mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-[#4f76c8] transition-colors">
                    Upload Document
                  </div>
                  <div className="text-[11px] text-[#94a3b8] mt-0.5">
                    Add DL, RC, FIR or bills
                  </div>
                </div>
              </button>

              <button
                onClick={() => onSelectClaim(MOCK_CLAIMS[0])}
                className="glass-card rounded-2xl p-4 text-left hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#7c5cbf]/15 border border-[#7c5cbf]/30 flex items-center justify-center text-[#7c5cbf] mb-3 group-hover:scale-105 transition-transform">
                  <FileBadge className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-[#7c5cbf] transition-colors">
                    Policy Coverage
                  </div>
                  <div className="text-[11px] text-[#94a3b8] mt-0.5">
                    IDV & Clause 2.1 terms
                  </div>
                </div>
              </button>

              <button
                onClick={() => onSelectClaim(MOCK_CLAIMS[2])}
                className="glass-card rounded-2xl p-4 text-left hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#06b6d4]/15 border border-[#06b6d4]/30 flex items-center justify-center text-[#06b6d4] mb-3 group-hover:scale-105 transition-transform">
                  <SearchCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-[#06b6d4] transition-colors">
                    Cross-Doc Check
                  </div>
                  <div className="text-[11px] text-[#94a3b8] mt-0.5">
                    Verify FIR vs Claim Form
                  </div>
                </div>
              </button>

              <button
                onClick={() => alert("Audit Report exported with deterministic IRDAI evidence SHA-256 hash.")}
                className="glass-card rounded-2xl p-4 text-left hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] mb-3 group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white group-hover:text-[#10b981] transition-colors">
                    AI Audit Report
                  </div>
                  <div className="text-[11px] text-[#94a3b8] mt-0.5">
                    Export evidence packet
                  </div>
                </div>
              </button>

            </div>

          </div>

          {/* D. RECENT CLAIMS TABLE */}
          <div className="rounded-3xl bg-[#0e1528]/80 border border-white/10 shadow-xl backdrop-blur-xl overflow-hidden">
            
            {/* Table Header Filter */}
            <div className="p-5 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Recent Motor Insurance Claims</h3>
                <p className="text-xs text-[#94a3b8] mt-0.5">Click any claim row to inspect AI evidence grounding & policy evaluation.</p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#111a33] border border-white/5 self-start">
                {['ALL', 'APPROVED', 'ACTION', 'REVIEW'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setClaimsFilter(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      claimsFilter === f
                        ? 'bg-[#4f76c8] text-white shadow-sm'
                        : 'text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#111a33]/60 text-[#94a3b8] font-semibold border-b border-white/5 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-5">Claim ID</th>
                    <th className="py-3.5 px-5">Vehicle</th>
                    <th className="py-3.5 px-5">Claim Type</th>
                    <th className="py-3.5 px-5">Incident Date</th>
                    <th className="py-3.5 px-5">Amount</th>
                    <th className="py-3.5 px-5">Status & Readiness</th>
                    <th className="py-3.5 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredClaims.map((claim) => (
                    <tr
                      key={claim.id}
                      className="hover:bg-[#162244]/50 transition-colors cursor-pointer group"
                      onClick={() => onSelectClaim(claim)}
                    >
                      <td className="py-4 px-5 font-mono font-bold text-[#4f76c8]">
                        {claim.id}
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-mono font-medium text-white">{claim.vehicleNumber}</div>
                        <div className="text-[11px] text-[#94a3b8]">{claim.vehicleModel}</div>
                      </td>
                      <td className="py-4 px-5 text-[#e2e8f0]">
                        {claim.type}
                      </td>
                      <td className="py-4 px-5 text-[#94a3b8] font-mono">
                        {claim.date}
                      </td>
                      <td className="py-4 px-5 font-mono font-bold text-white">
                        ₹{claim.amount.toLocaleString()}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatusBadgeClass(claim.statusBadge)}`}>
                            {claim.status}
                          </span>
                          <span className="font-mono text-[10px] text-[#94a3b8]">{claim.readiness}%</span>
                        </div>
                        {/* Mini progress bar */}
                        <div className="w-24 h-1 rounded-full bg-[#111a33] overflow-hidden">
                          <div 
                            className={`h-full ${getProgressBarColor(claim.statusBadge)}`}
                            style={{ width: `${claim.readiness}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectClaim(claim);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#162244] group-hover:bg-[#4f76c8] text-white text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>View</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

        </main>

      </div>

    </div>
  );
}
