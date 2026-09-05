import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import ClaimDetailModal from './components/ClaimDetailModal';
import StartClaimModal from './components/StartClaimModal';
import SearchModal from './components/SearchModal';
import UploadDocModal from './components/UploadDocModal';
import { MOCK_CLAIMS } from './data/mockData';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login'); // 'login' | 'dashboard'
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocTarget, setUploadDocTarget] = useState('');

  // Handle global keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUploadMissing = (docName) => {
    setUploadDocTarget(docName);
    setShowUploadModal(true);
  };

  const handleUploadSuccess = (docName) => {
    // If we just uploaded a missing document for CLM-2026-002, upgrade it!
    if (docName === 'Driving Licence' || uploadDocTarget === 'Driving Licence') {
      const claim2 = MOCK_CLAIMS.find(c => c.id === 'CLM-2026-002');
      if (claim2) {
        claim2.status = 'Approved';
        claim2.statusBadge = 'approved';
        claim2.readiness = 100;
        claim2.summary = 'Driving licence verified successfully under Clause 5.1. All policy gates passed!';
        const dlDoc = claim2.documents.find(d => d.name === 'Driving Licence');
        if (dlDoc) {
          dlDoc.status = 'Verified';
          dlDoc.extracted = 'Valid Till: 2035-11-14 · Class: LMV-NT';
        }
        const dlCheck = claim2.checks.find(c => c.id === 'POL-5.1');
        if (dlCheck) {
          dlCheck.status = 'Pass';
          dlCheck.note = 'Valid license confirmed.';
        }
      }
    }
  };

  const handleCreateNewClaim = (newClaimData) => {
    const newId = `CLM-2026-00${MOCK_CLAIMS.length + 1}`;
    const createdClaim = {
      id: newId,
      vehicleNumber: newClaimData.vehicleNumber,
      vehicleModel: "Maruti Suzuki Swift Dzire",
      type: newClaimData.type,
      category: newClaimData.type === 'Accident Claim' ? 'Collision Damage' : 'Component Theft',
      date: newClaimData.date,
      amount: newClaimData.amount,
      status: "Under Review",
      statusBadge: "escalated",
      readiness: 75,
      policyNumber: "POL-2026-104",
      incidentLocation: newClaimData.location,
      driverName: "Jaswanth G",
      summary: "Newly submitted claim. Automated OCR extraction and policy rule evaluation underway.",
      documents: [
        { name: "Claim Form", status: "Verified", file: "uploaded_form.pdf", pages: 2, extracted: `Date: ${newClaimData.date}` },
        { name: newClaimData.type === 'Accident Claim' ? "Repair Estimate" : "Police FIR Report", status: "Verified", file: "quote.pdf", pages: 1, extracted: `Amount: ₹${newClaimData.amount.toLocaleString()}` },
        { name: "Registration Certificate", status: "Verified", file: "rc.pdf", pages: 1, extracted: `Vehicle: ${newClaimData.vehicleNumber}` }
      ],
      checks: [
        { id: "POL-2.1", title: "Preliminary Coverage Check", status: "Pass", citation: "Clause 2.1 — Damage Check", note: "Covered peril confirmed." },
        { id: "POL-4.1", title: "Incident Window", status: "Pass", citation: "Clause 4.1 — Notification", note: "Reported promptly." }
      ],
      idvImpact: 0
    };
    MOCK_CLAIMS.unshift(createdClaim);
    setShowStartModal(false);
    setSelectedClaim(createdClaim);
  };

  return (
    <div className="w-full min-h-screen bg-[#080c18]">
      {currentScreen === 'login' ? (
        <LoginPage onEnter={() => setCurrentScreen('dashboard')} />
      ) : (
        <Dashboard
          onSignOut={() => setCurrentScreen('login')}
          onSelectClaim={(claim) => setSelectedClaim(claim)}
          onStartClaim={() => setShowStartModal(true)}
          onOpenSearch={() => setShowSearchModal(true)}
          onOpenUpload={() => setShowUploadModal(true)}
        />
      )}

      {/* Claim Detail Inspection Modal */}
      {selectedClaim && (
        <ClaimDetailModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onUploadMissing={handleUploadMissing}
        />
      )}

      {/* Start New Claim Wizard Modal */}
      {showStartModal && (
        <StartClaimModal
          onClose={() => setShowStartModal(false)}
          onSubmitClaim={handleCreateNewClaim}
        />
      )}

      {/* Search Modal (⌘K / Ctrl+K) */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectClaim={(claim) => setSelectedClaim(claim)}
      />

      {/* Upload Document Modal */}
      {showUploadModal && (
        <UploadDocModal
          defaultDocName={uploadDocTarget}
          onClose={() => {
            setShowUploadModal(false);
            setUploadDocTarget('');
          }}
          onUploadSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
