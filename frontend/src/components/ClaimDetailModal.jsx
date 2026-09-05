import React from 'react';
import { X, ShieldCheck, AlertTriangle, FileText, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';

export default function ClaimDetailModal({ claim, onClose, onUploadMissing }) {
  if (!claim) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#080c18]/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0e1528] border border-white/10 shadow-2xl p-6 sm:p-8 flex flex-col justify-between">
        
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
            <div className="flex items-center gap-3">
              <div className="font-mono text-lg font-bold text-[#4f76c8]">
                {claim.id}
              </div>
              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                claim.statusBadge === 'approved' ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30' :
                claim.statusBadge === 'warning' ? 'bg-[#d97706]/20 text-[#f59e0b] border border-[#d97706]/30' :
                claim.statusBadge === 'escalated' ? 'bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/30' :
                'bg-[#e11d48]/20 text-[#f43f5e] border border-[#e11d48]/30'
              }`}>
                {claim.status}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 rounded-xl bg-[#111a33]/60 border border-white/5">
              <div className="text-[11px] text-[#94a3b8]">Vehicle</div>
              <div className="font-mono font-bold text-white text-xs mt-0.5">{claim.vehicleNumber}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#111a33]/60 border border-white/5">
              <div className="text-[11px] text-[#94a3b8]">Claim Amount</div>
              <div className="font-mono font-bold text-white text-xs mt-0.5">₹{claim.amount.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#111a33]/60 border border-white/5">
              <div className="text-[11px] text-[#94a3b8]">AI Readiness</div>
              <div className="font-mono font-bold text-[#10b981] text-xs mt-0.5">{claim.readiness}% Complete</div>
            </div>
          </div>

          {/* Incident Summary */}
          <div className="mb-6 p-4 rounded-2xl bg-[#111a33]/40 border border-white/5">
            <div className="text-xs font-semibold text-white mb-1">AI Evidence Assessment</div>
            <p className="text-xs text-[#94a3b8] leading-relaxed">{claim.summary}</p>
          </div>

          {/* Documents Checklist */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-white mb-2.5">Uploaded Claim Documents</div>
            <div className="space-y-2">
              {claim.documents.map((doc, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#111a33]/60 border border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-[#4f76c8]" />
                    <div>
                      <div className="font-medium text-white">{doc.name}</div>
                      <div className="text-[11px] text-[#94a3b8]">{doc.extracted}</div>
                    </div>
                  </div>
                  {doc.status === 'Verified' ? (
                    <span className="text-[#10b981] flex items-center gap-1 font-semibold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        onClose();
                        onUploadMissing(doc.name);
                      }}
                      className="px-2.5 py-1 rounded bg-[#f59e0b] hover:bg-[#d97706] text-[#080c18] font-bold text-[11px] cursor-pointer"
                    >
                      + Upload
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Policy Clauses Evaluated */}
          <div>
            <div className="text-xs font-semibold text-white mb-2.5">Policy Terms & Clause Verification</div>
            <div className="space-y-2">
              {claim.checks.map((chk, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#111a33]/40 border border-white/5 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white">{chk.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      chk.status === 'Pass' ? 'bg-[#10b981]/15 text-[#10b981]' :
                      chk.status === 'Warning' ? 'bg-[#f59e0b]/15 text-[#f59e0b]' :
                      'bg-[#f43f5e]/15 text-[#f43f5e]'
                    }`}>
                      {chk.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#4f76c8] font-mono">{chk.citation}</div>
                  <div className="text-[11px] text-[#94a3b8] mt-1">{chk.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-8 pt-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#162244] hover:bg-[#1c2b54] text-white text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
