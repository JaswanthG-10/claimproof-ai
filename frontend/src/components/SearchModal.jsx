import React, { useState, useEffect } from 'react';
import { X, Search, FileText, ArrowRight } from 'lucide-react';
import { MOCK_CLAIMS } from '../data/mockData';

export default function SearchModal({ isOpen, onClose, onSelectClaim }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose(); // toggle
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const results = MOCK_CLAIMS.filter(c => 
    c.id.toLowerCase().includes(query.toLowerCase()) ||
    c.vehicleNumber.toLowerCase().includes(query.toLowerCase()) ||
    c.type.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-[#080c18]/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#0e1528] border border-white/10 shadow-2xl p-4 sm:p-6">
        
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 pb-3 border-b border-white/10">
          <Search className="w-5 h-5 text-[#4f76c8]" />
          <input
            type="text"
            placeholder="Type claim ID, vehicle number, or document..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-[#94a3b8]"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#94a3b8]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
          {results.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                onSelectClaim(c);
                onClose();
              }}
              className="p-3 rounded-xl bg-[#111a33]/60 hover:bg-[#162244] border border-white/5 flex items-center justify-between text-xs cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-[#4f76c8]" />
                <div>
                  <div className="font-mono font-bold text-white">{c.id} · {c.vehicleNumber}</div>
                  <div className="text-[11px] text-[#94a3b8]">{c.type} · ₹{c.amount.toLocaleString()}</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#94a3b8]" />
            </div>
          ))}
          {results.length === 0 && (
            <div className="py-6 text-center text-xs text-[#94a3b8]">
              No matching claims found.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
