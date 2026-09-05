import React, { useState } from 'react';
import { X, UploadCloud, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';

export default function UploadDocModal({ defaultDocName, onClose, onUploadSuccess }) {
  const [docType, setDocType] = useState(defaultDocName || 'Driving Licence');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSimulatedUpload = () => {
    if (!fileName) {
      setFileName(`${docType.toLowerCase().replace(/\s+/g, '_')}_scanned.pdf`);
    }
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setDone(true);
      setTimeout(() => {
        onUploadSuccess(docType);
        onClose();
      }, 900);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080c18]/80 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-3xl bg-[#0e1528] border border-white/10 shadow-2xl p-6">
        
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <h3 className="text-base font-bold text-white">Upload Claim Evidence</h3>
          <button onClick={onClose} className="p-1 rounded-lg bg-white/5 text-[#94a3b8] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#94a3b8] mb-1">Document Category</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#111a33] border border-white/10 text-xs text-white focus:outline-none"
            >
              <option value="Driving Licence">Driving Licence (DL)</option>
              <option value="Registration Certificate">Registration Certificate (RC)</option>
              <option value="Repair Estimate">Itemized Repair Estimate</option>
              <option value="Signed Claim Form">Signed Claim Form</option>
              <option value="Police FIR Report">Police FIR Report</option>
            </select>
          </div>

          {/* Dropzone */}
          <div 
            onClick={handleSimulatedUpload}
            className="border-2 border-dashed border-white/15 hover:border-[#4f76c8] rounded-2xl p-6 text-center cursor-pointer transition-colors bg-[#111a33]/40"
          >
            <UploadCloud className="w-8 h-8 text-[#4f76c8] mx-auto mb-2" />
            <div className="text-xs font-semibold text-white">
              {uploading ? "Extracting OCR & Policy Fields..." : done ? "Verification Successful!" : "Click to select or drop document"}
            </div>
            <div className="text-[11px] text-[#94a3b8] mt-1">
              Supports PDF, PNG, JPEG up to 15MB
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-[#94a3b8]"
            >
              Cancel
            </button>
            <button
              onClick={handleSimulatedUpload}
              disabled={uploading || done}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#4f76c8] to-[#7c5cbf] text-white text-xs font-semibold shadow-md"
            >
              {uploading ? "Analyzing..." : done ? "Done ✓" : "Upload & Analyze"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
