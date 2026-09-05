import React, { useState } from 'react';
import { X, Car, Lock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function StartClaimModal({ onClose, onSubmitClaim }) {
  const [claimType, setClaimType] = useState('accident');
  const [incidentDate, setIncidentDate] = useState('2026-08-29');
  const [vehicleNo, setVehicleNo] = useState('TN00DM2026');
  const [amount, setAmount] = useState('45000');
  const [location, setLocation] = useState('Anna Salai, Chennai');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmitClaim({
      type: claimType === 'accident' ? 'Accident Claim' : 'Theft Claim',
      date: incidentDate,
      vehicleNumber: vehicleNo,
      amount: parseInt(amount, 10) || 45000,
      location
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080c18]/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0e1528] border border-white/10 shadow-2xl p-6 sm:p-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">Start New Claim</h3>
            <p className="text-xs text-[#94a3b8]">ClaimProofAI Evidence-Grounded Claim Wizard</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Claim Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-2">Claim Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setClaimType('accident')}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
                  claimType === 'accident'
                    ? 'bg-[#4f76c8]/15 border-[#4f76c8] text-white'
                    : 'bg-[#111a33]/60 border-white/5 text-[#94a3b8] hover:border-white/20'
                }`}
              >
                <Car className="w-5 h-5 text-[#4f76c8]" />
                <div>
                  <div className="font-bold text-xs">Accident Claim</div>
                  <div className="text-[10px] text-[#94a3b8]">Collision & repair</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setClaimType('theft')}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
                  claimType === 'theft'
                    ? 'bg-[#7c5cbf]/15 border-[#7c5cbf] text-white'
                    : 'bg-[#111a33]/60 border-white/5 text-[#94a3b8] hover:border-white/20'
                }`}
              >
                <Lock className="w-5 h-5 text-[#7c5cbf]" />
                <div>
                  <div className="font-bold text-xs">Theft Claim</div>
                  <div className="text-[10px] text-[#94a3b8]">Missing component</div>
                </div>
              </button>
            </div>
          </div>

          {/* Upfront Checklist Preview */}
          <div className="p-3 rounded-xl bg-[#111a33]/40 border border-white/5 text-xs">
            <div className="font-semibold text-[#e2e8f0] mb-1">
              Required Documents for {claimType === 'accident' ? 'Accident' : 'Theft'} Claim:
            </div>
            <div className="space-y-1 text-[#94a3b8] text-[11px]">
              <div>✓ Signed Claim Form</div>
              <div>✓ {claimType === 'accident' ? 'Itemized Repair Estimate' : 'Police FIR Report'}</div>
              <div>✓ Registration Certificate (RC)</div>
              {claimType === 'accident' && <div>✓ Valid Driving Licence</div>}
            </div>
          </div>

          {/* Vehicle Number */}
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Vehicle Registration Number</label>
            <input
              type="text"
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#111a33] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#4f76c8]"
              required
            />
          </div>

          {/* Incident Date & Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Incident Date</label>
              <input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#111a33] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#4f76c8]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Estimated Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#111a33] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#4f76c8]"
                required
              />
            </div>
          </div>

          {/* Incident Location */}
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Incident Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#111a33] border border-white/10 text-xs text-white focus:outline-none focus:border-[#4f76c8]"
              required
            />
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 text-[#94a3b8] text-xs font-medium hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#4f76c8] to-[#7c5cbf] hover:opacity-90 text-white font-semibold text-xs shadow-md"
            >
              Create Claim & Proceed
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
