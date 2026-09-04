// ==========================================
// CLAIMPROOF AI - CUSTOMER APP CONTROLLER & SPA
// ==========================================

const state = {
    currentView: 'dashboard',
    sidebarCollapsed: false,
    activeClaim: null,
    claimsList: [],
    auditLogs: [],
    allPolicies: [],
    userName: 'Jaswanth G.',
    userRole: 'Policy Holder',
    policyNumber: 'POL-2026-104',
    policyFilter: 'all',
    claimStep: 1,
    selectedType: 'accident'
};

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    checkHealth();
});

function initApp() {
    fetchDemoCasesList();
    loadSidebarState();
}

async function checkHealth() {
    try {
        const res = await fetch('/health');
        await res.json();
    } catch (e) {
        console.warn('Health check fallback:', e);
    }
}

function setupEventListeners() {
    // Sidebar Nav Click Handlers
    document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            navigateTo(view);
        });
    });

    // Keyboard Command Palette Shortcut (Ctrl+K or Cmd+K)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            toggleCommandPalette();
        } else if (e.key === 'Escape') {
            closeAllOverlays();
        }
    });

    // Global Click Handler to close dropdown popups
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#sidebar-profile-btn') && !e.target.closest('#profile-popup-menu')) {
            document.getElementById('profile-popup-menu')?.classList.add('hidden');
        }
    });

    // Policy Filter Chips
    document.querySelectorAll('#policy-filter-chips .filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#policy-filter-chips .filter-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.policyFilter = btn.getAttribute('data-policy-filter') || 'all';
            renderPolicyLibrary();
        });
    });

    // Claims Filter Pills
    document.querySelectorAll('#claims-filter-pills .filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#claims-filter-pills .filter-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterClaimsTable(btn.getAttribute('data-filter') || 'all');
        });
    });

    document.getElementById('cmd-search-trigger')?.addEventListener('click', toggleCommandPalette);
    document.getElementById('cmd-input')?.addEventListener('input', (e) => handleCmdSearch(e.target.value));

    // Assistant Composer Submit
    document.getElementById('ws-assistant-send-btn')?.addEventListener('click', handleAssistantSubmit);
    document.getElementById('ws-assistant-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAssistantSubmit();
    });
}


/* ========================================== */
/* SIDEBAR COLLAPSE & PROFILE MENU            */
/* ========================================== */

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed');
    state.sidebarCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('claimproof_sidebar_collapsed', state.sidebarCollapsed ? 'true' : 'false');
}

function loadSidebarState() {
    const isCollapsed = localStorage.getItem('claimproof_sidebar_collapsed') === 'true';
    if (isCollapsed) {
        document.getElementById('sidebar')?.classList.add('collapsed');
        state.sidebarCollapsed = true;
    }
}

function toggleProfileMenu() {
    document.getElementById('profile-popup-menu')?.classList.toggle('hidden');
}


/* ========================================== */
/* NAVIGATION & VIEW ROUTER                  */
/* ========================================== */

function navigateTo(viewName) {
    state.currentView = viewName;

    // Hide all content views & display active target
    document.querySelectorAll('.content-view').forEach(el => el.classList.add('hidden'));
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.remove('hidden');

    // Update active nav items
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
        if (el.getAttribute('data-view') === viewName) el.classList.add('active');
        else el.classList.remove('active');
    });

    // Breadcrumb title map
    const titles = {
        'dashboard': 'Home',
        'my-claims': 'My Claims',
        'workspace': 'Check My Claim',
        'documents': 'My Documents',
        'missing-documents': 'Missing Documents',
        'policies': 'My Coverage',
        'policy-details': 'Policy Details',
        'claim-status': 'Claim Status',
        'claim-report': 'Claim Report',
        'settings': 'Settings'
    };

    if (titles[viewName]) {
        document.getElementById('breadcrumb-current').innerText = titles[viewName];
    }

    // Refresh view data
    if (viewName === 'my-claims') renderClaimsTable();
    else if (viewName === 'documents') renderDocumentsTable();
    else if (viewName === 'policies' || viewName === 'policy-details') renderPolicyLibrary();
}


/* ========================================== */
/* MULTI-STEP START CLAIM FLOW                */
/* ========================================== */

function openStartClaimModal() {
    state.claimStep = 1;
    goToClaimStep(1);
    document.getElementById('modal-start-claim')?.classList.remove('hidden');
}

function closeStartClaimModal() {
    document.getElementById('modal-start-claim')?.classList.add('hidden');
}

function goToClaimStep(stepNumber) {
    state.claimStep = stepNumber;
    for (let i = 1; i <= 4; i++) {
        const stepPanel = document.getElementById(`claim-step-${i}`);
        const pill = document.getElementById(`step-pill-${i}`);
        if (stepPanel) {
            if (i === stepNumber) stepPanel.classList.remove('hidden');
            else stepPanel.classList.add('hidden');
        }
        if (pill) {
            if (i === stepNumber) pill.classList.add('active');
            else pill.classList.remove('active');
        }
    }
}

function selectClaimType(type, element) {
    state.selectedType = type;
    document.querySelectorAll('.claim-type-card').forEach(c => c.classList.remove('active'));
    element?.classList.add('active');
}

async function submitNewClaimForm() {
    const fileInput = document.getElementById('modal-files');
    if (!fileInput.files || fileInput.files.length === 0) {
        // Fallback demo claim if no files selected
        runDemoClaimFromModal('claim_001_approve');
        return;
    }

    closeStartClaimModal();
    showProcessingModal();

    const claimId = `CLM-CUSTOM-${Math.floor(100 + Math.random() * 900)}`;
    const formData = new FormData();
    formData.append('claim_id', claimId);
    for (let i = 0; i < fileInput.files.length; i++) {
        formData.append('files', fileInput.files[i]);
    }

    try {
        const res = await fetch('/api/claims/analyze', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Claim analysis error');
        const data = await res.json();

        state.activeClaim = data;
        state.claimsList.unshift(data);

        setTimeout(() => {
            hideProcessingModal();
            renderWorkspace(data);
            renderDashboardRecentTable();
            navigateTo('workspace');
            showToast('AI Check Complete', `Readiness Assessment: ${formatRecText(data.recommendation)}`, 'success');
        }, 600);

    } catch (e) {
        hideProcessingModal();
        showToast('Error', `Failed claim check: ${e.message}`, 'error');
    }
}


/* ========================================== */
/* DEMO CASES RUNNER                          */
/* ========================================== */

async function fetchDemoCasesList() {
    try {
        const res = await fetch('/api/demo-cases');
        if (res.ok) {
            await res.json();
            runDemoClaim('claim_001_approve', false);
        }
    } catch (e) {
        console.warn('Demo cases prefetch fallback:', e);
    }
}

async function runDemoClaim(caseId, navigate = true) {
    if (navigate) showProcessingModal();

    try {
        const res = await fetch(`/api/demo-cases/${caseId}/analyze`, { method: 'POST' });
        if (!res.ok) throw new Error('API processing error');
        const data = await res.json();

        state.activeClaim = data;

        const idx = state.claimsList.findIndex(c => c.claim_id === data.claim_id);
        if (idx >= 0) state.claimsList[idx] = data;
        else state.claimsList.unshift(data);

        addAuditLog(data.claim_id, `AI Readiness Assessment: ${data.recommendation}`);

        if (navigate) {
            setTimeout(() => {
                hideProcessingModal();
                renderWorkspace(data);
                renderDashboardRecentTable();
                navigateTo('workspace');
                showToast('AI Claim Check Complete', `Readiness: ${formatRecText(data.recommendation)}`, 'success');
            }, 600);
        } else {
            renderWorkspace(data);
            renderDashboardRecentTable();
        }

    } catch (err) {
        hideProcessingModal();
        showToast('Error', `Failed claim check: ${err.message}`, 'error');
    }
}

function runDemoClaimFromModal(caseId) {
    closeStartClaimModal();
    runDemoClaim(caseId, true);
}


/* ========================================== */
/* PRELIMINARY AI ASSESSMENT & CHECK MY CLAIM */
/* ========================================== */

function renderWorkspace(claim) {
    if (!claim) return;

    // Header info
    document.getElementById('ws-claim-id').innerText = claim.claim_id;
    document.getElementById('ws-incident-badge').innerText = claim.incident_type ? claim.incident_type.charAt(0).toUpperCase() + claim.incident_type.slice(1) : 'Accident';

    const statusBadge = document.getElementById('ws-status-badge');
    statusBadge.innerText = formatRecText(claim.recommendation);
    statusBadge.className = `badge-status ${getBadgeClass(claim.recommendation)}`;

    // Left Panel: Documents & Evidence (Available vs Missing)
    const reqDocs = claim.completeness?.required_documents || [];
    const missingDocs = claim.completeness?.missing_documents || [];
    const availableDocs = reqDocs.filter(d => !missingDocs.includes(d));

    const missingList = document.getElementById('ws-doc-missing-list');
    const availList = document.getElementById('ws-doc-available-list');
    missingList.innerHTML = '';
    availList.innerHTML = '';

    const availableCount = availableDocs.length + 1; // Including Policy Schedule
    document.getElementById('ws-doc-counter').innerText = `${availableCount} of 4 available`;

    // Render Available Documents
    const policyRow = document.createElement('div');
    policyRow.className = 'doc-status-row positive';
    policyRow.style.padding = '8px 12px';
    policyRow.style.background = 'var(--surface-secondary)';
    policyRow.style.borderRadius = '6px';
    policyRow.style.marginTop = '6px';
    policyRow.style.fontSize = '13px';
    policyRow.style.fontWeight = '500';
    policyRow.innerHTML = `<span style="color:var(--success);">✓ Policy Document</span>`;
    policyRow.onclick = () => navigateTo('policies');
    availList.appendChild(policyRow);

    availableDocs.forEach(doc => {
        const div = document.createElement('div');
        div.className = 'doc-status-row positive';
        div.style.padding = '8px 12px';
        div.style.background = 'var(--surface-secondary)';
        div.style.borderRadius = '6px';
        div.style.marginTop = '6px';
        div.style.fontSize = '13px';
        div.style.fontWeight = '500';
        div.innerHTML = `<span style="color:var(--success);">✓ ${doc.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>`;
        div.onclick = () => openDocumentDrawer(`${doc}.pdf`, claim.evidence_items?.find(e => e.source_document.includes(doc))?.raw_text || "Document text content.");
        availList.appendChild(div);
    });

    // Render Missing Documents
    if (missingDocs.length > 0) {
        missingDocs.forEach(doc => {
            const div = document.createElement('div');
            div.className = 'doc-status-row warning';
            div.style.padding = '8px 12px';
            div.style.background = 'rgba(251, 191, 36, 0.12)';
            div.style.border = '1px solid rgba(251, 191, 36, 0.3)';
            div.style.borderRadius = '6px';
            div.style.marginTop = '6px';
            div.style.fontSize = '13px';
            div.style.fontWeight = '600';
            div.innerHTML = `<span style="color:var(--warning);">! ${doc.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>`;
            missingList.appendChild(div);
        });
    } else {
        missingList.innerHTML = `<div class="metadata-text" style="color:var(--success); padding:6px 0;">✓ All required documents available.</div>`;
    }

    // Center Panel: Claim Summary Facts Grid
    document.getElementById('ws-fact-name').innerText = claim.customer_name || 'Arjun Mehta';
    document.getElementById('ws-fact-vehicle').innerText = claim.vehicle_number || 'TN00DM2026';
    document.getElementById('ws-fact-type').innerText = claim.incident_type ? claim.incident_type.charAt(0).toUpperCase() + claim.incident_type.slice(1) : 'Accident';
    document.getElementById('ws-fact-date').innerText = claim.incident_date || 'Not specified';
    document.getElementById('ws-fact-amount').innerText = claim.claimed_amount ? `₹${Number(claim.claimed_amount).toLocaleString('en-IN')}` : '₹48,750';

    // Contradictions / Mismatches Cards
    const cCard = document.getElementById('ws-contradiction-card');
    const cContainer = document.getElementById('ws-contradictions-container');
    const contradictions = claim.contradictions || [];

    if (contradictions.length > 0) {
        cCard.classList.remove('hidden');
        document.getElementById('ws-issues-count-badge').innerText = `${contradictions.length} Issue${contradictions.length > 1 ? 's' : ''}`;
        cContainer.innerHTML = '';

        contradictions.forEach(c => {
            const card = document.createElement('div');
            card.className = 'issue-card';
            card.innerHTML = `
                <div class="issue-card-top">
                    <span class="issue-title">! ${c.field_name.replace('_', ' ').toUpperCase()} MISMATCH</span>
                    <span class="badge-status request">POTENTIAL ISSUE</span>
                </div>
                <div class="issue-desc">${c.description}</div>
                <div class="issue-comparison-table">
                    <div class="comp-box">
                        <span>Source A (${c.source_a} P.${c.page_a})</span>
                        <strong>${c.value_a}</strong>
                    </div>
                    <div class="comp-box">
                        <span>Source B (${c.source_b} P.${c.page_b})</span>
                        <strong>${c.value_b}</strong>
                    </div>
                </div>
            `;
            cContainer.appendChild(card);
        });
    } else {
        cCard.classList.add('hidden');
    }

    // Right Panel: Customer-Friendly AI Claim Assessment
    const recCard = document.getElementById('ws-rec-card');
    const recType = (claim.recommendation || 'APPROVE').toUpperCase();
    recCard.className = `card-enterprise recommendation-panel ${recType.toLowerCase()}`;
    
    const recTitleEl = document.getElementById('ws-rec-title');
    const recSummaryEl = document.getElementById('ws-rec-summary');
    const recExplanationEl = document.getElementById('ws-rec-explanation');
    const recGuidanceEl = document.getElementById('ws-rec-guidance');

    recTitleEl.innerText = formatRecText(recType);

    if (recType === 'APPROVE') {
        recSummaryEl.innerText = "Your claim currently appears ready for submission with complete required documentation and valid policy coverage.";
        recExplanationEl.innerHTML = "✓ All mandatory documents available<br>✓ Valid coverage dates verified<br>✓ Repair estimate within policy limits";
        recGuidanceEl.innerText = "You can proceed to submit your claim package to your insurer.";
    } else if (recType === 'REQUEST_INFORMATION' || recType === 'REQ_INFO') {
        recSummaryEl.innerText = "Your claim currently appears to meet some policy requirements, but additional information is needed before it is ready.";
        recExplanationEl.innerHTML = "! Driving Licence missing<br>! Incident Date not provided on Claim Form";
        recGuidanceEl.innerText = "Upload your driving licence and provide the incident date to make your claim ready.";
    } else if (recType === 'ESCALATE') {
        recSummaryEl.innerText = "A date contradiction was detected across your submitted evidence that requires clarification.";
        recExplanationEl.innerHTML = "! Incident Date mismatch between Claim Form (Aug 21) and Police FIR (Aug 22)";
        recGuidanceEl.innerText = "Update your incident date or submit a updated statement to clarify the mismatch.";
    } else if (recType === 'REJECT') {
        recSummaryEl.innerText = "A potential policy exclusion clause was identified during the automated coverage check.";
        recExplanationEl.innerHTML = "! Vehicle operated for commercial ride-share taxi use (Exclusion Clause 4.2)";
        recGuidanceEl.innerText = "Review exclusion Clause 4.2 or contact customer support for clarification.";
    }
}


/* ========================================== */
/* TABLES & CUSTOMER LIST RENDERERS           */
/* ========================================== */

function renderDashboardRecentTable() {
    const tbody = document.getElementById('dashboard-recent-claims-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    state.claimsList.slice(0, 5).forEach(c => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => openClaimWorkspace(c.claim_id);
        tr.innerHTML = `
            <td><strong>${c.claim_id}</strong></td>
            <td>${c.vehicle_number}</td>
            <td>${c.incident_type ? c.incident_type.toUpperCase() : 'ACCIDENT'}</td>
            <td>${c.incident_date || 'Not specified'}</td>
            <td>₹${Number(c.claimed_amount || 48750).toLocaleString('en-IN')}</td>
            <td><span class="status-badge ${getBadgeClass(c.recommendation)}">${formatRecText(c.recommendation)}</span></td>
            <td><button class="btn-tertiary-link">Continue →</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderClaimsTable() {
    const tbody = document.getElementById('claims-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    state.claimsList.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.claim_id}</strong></td>
            <td>${c.incident_type ? c.incident_type.toUpperCase() : 'ACCIDENT'}</td>
            <td>${c.vehicle_number}</td>
            <td>${c.incident_date || 'Not specified'}</td>
            <td>₹${Number(c.claimed_amount || 48750).toLocaleString('en-IN')}</td>
            <td><span class="status-badge ${getBadgeClass(c.recommendation)}">${formatRecText(c.recommendation)}</span></td>
            <td>${c.completeness?.missing_documents?.length > 0 ? `${4 - c.completeness.missing_documents.length}/4 Docs` : '4/4 Docs Ready'}</td>
            <td><button class="btn-tertiary-link" onclick="openClaimWorkspace('${c.claim_id}')">Continue</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('sidebar-claims-count').innerText = state.claimsList.length;
}

function openClaimWorkspace(claimId) {
    const found = state.claimsList.find(c => c.claim_id === claimId);
    if (found) {
        state.activeClaim = found;
        renderWorkspace(found);
        navigateTo('workspace');
    }
}

function renderDocumentsTable() {
    const tbody = document.getElementById('documents-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const docs = [
        { name: 'Claim_Form_Arjun_Mehta.pdf', type: 'Claim Form', claimId: 'CLM-CUSTOM-001', date: '2026-09-04', status: 'Uploaded' },
        { name: 'Repair_Estimate_Invoice.pdf', type: 'Repair Estimate', claimId: 'CLM-CUSTOM-001', date: '2026-09-04', status: 'Verified' },
        { name: 'Registration_Certificate_RC.pdf', type: 'RC Document', claimId: 'CLM-CUSTOM-001', date: '2026-09-04', status: 'Verified' }
    ];

    docs.forEach(doc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${doc.name}</strong></td>
            <td><span class="badge-neutral">${doc.type}</span></td>
            <td>${doc.claimId}</td>
            <td>${doc.date}</td>
            <td><span class="status-badge approve">✓ ${doc.status}</span></td>
            <td>
                <button class="btn-tertiary-link" onclick="openDocumentDrawer('${doc.name}', 'Document preview content.')">View</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPolicyLibrary() {
    const grid = document.getElementById('policy-library-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const assessments = state.activeClaim?.policy_assessments || [];

    assessments.forEach(c => {
        const category = (c.category || 'COVERAGE').toUpperCase();

        if (state.policyFilter !== 'all') {
            if (state.policyFilter === 'required' && !category.includes('REQUIRED') && !category.includes('DOCUMENT')) return;
            if (state.policyFilter === 'coverage' && !category.includes('COVERAGE')) return;
            if (state.policyFilter === 'exclusions' && !category.includes('EXCLUSION')) return;
            if (state.policyFilter === 'idv' && !category.includes('LIMIT') && !category.includes('IDV')) return;
        }

        const div = document.createElement('div');
        div.className = 'card-enterprise sub-card mb-12';
        div.innerHTML = `
            <div class="card-header-flex">
                <span class="important-value">${c.clause_id} · ${c.clause_title}</span>
                <span class="badge-neutral">${category}</span>
            </div>
            <p class="body-text mt-8">"${c.clause_text}"</p>
            <button class="btn-tertiary-link mt-8" onclick="openPolicyDrawer(${JSON.stringify(c).replace(/"/g, '&quot;')})">View Original Clause →</button>
        `;
        grid.appendChild(div);
    });
}

function filterClaimsTable(filterType) {
    const rows = document.querySelectorAll('#claims-table-body tr');
    rows.forEach(row => {
        if (filterType === 'all') {
            row.style.display = '';
        } else {
            const badge = row.querySelector('.status-badge');
            if (badge && badge.innerText.toUpperCase().includes(filterType.toUpperCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });
}

function saveSettingsProfile() {
    const newName = document.getElementById('settings-name-input').value.trim();
    if (newName) {
        state.userName = newName;
        document.querySelectorAll('.user-name, .user-display-name').forEach(el => el.innerText = newName);
    }
    showToast('Profile Saved', 'Personal information updated successfully.', 'success');
}


/* ========================================== */
/* ASSISTANT & OVERLAYS                       */
/* ========================================== */

function askAssistant(queryText) {
    document.getElementById('ws-assistant-input').value = queryText;
    handleAssistantSubmit();
}

function handleAssistantSubmit() {
    const input = document.getElementById('ws-assistant-input');
    const val = input.value.trim();
    if (!val || !state.activeClaim) return;

    input.value = '';

    let answer = `Regarding "${val}": Claim ${state.activeClaim.claim_id} assessment is ${formatRecText(state.activeClaim.recommendation)}.`;
    if (val.includes('more info') || val.includes('missing')) {
        const missing = state.activeClaim.completeness?.missing_documents || [];
        answer = missing.length > 0 ? `More information is needed because the following document(s) are missing: ${missing.join(', ')}.` : "All required documents are available for your claim.";
    } else if (val.includes('clause') || val.includes('policy')) {
        answer = `Relevant policy conditions evaluated: ${state.activeClaim.policy_assessments?.map(pa => `${pa.clause_id} (${pa.clause_title})`).join(', ')}`;
    }

    showToast('ClaimProof Assistant', answer, 'info');
}

function showProcessingModal() { document.getElementById('modal-processing')?.classList.remove('hidden'); }
function hideProcessingModal() { document.getElementById('modal-processing')?.classList.add('hidden'); }

function openDocumentDrawer(filename, text) {
    document.getElementById('drawer-doc-filename').innerText = filename;
    document.getElementById('drawer-doc-content').innerText = text || "Document text content.";
    document.getElementById('drawer-document')?.classList.remove('hidden');
}

function openPolicyDrawer(pa) {
    document.getElementById('drawer-policy-id').innerText = `${pa.clause_id} - ${pa.clause_title}`;
    const body = document.getElementById('drawer-policy-body');
    body.innerHTML = `
        <span class="badge-neutral">Page ${pa.page}</span>
        <span class="status-badge ${getBadgeClass(pa.classification)}">${pa.classification}</span>
        <p class="body-text mt-12">"${pa.clause_text}"</p>
        <div class="mt-16"><strong>Policy Rule Application:</strong><p class="body-text mt-4">${pa.reasoning}</p></div>
    `;
    document.getElementById('drawer-policy')?.classList.remove('hidden');
}

function closeDrawer(id) { document.getElementById(id)?.classList.add('hidden'); }

function toggleCommandPalette() {
    const modal = document.getElementById('modal-command-palette');
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        document.getElementById('cmd-input').focus();
        handleCmdSearch('');
    } else {
        modal.classList.add('hidden');
    }
}

function handleCmdSearch(query) {
    const list = document.getElementById('cmd-results');
    list.innerHTML = '';
    const q = query.toLowerCase();

    const items = [
        { title: 'Start New Claim', action: () => { toggleCommandPalette(); openStartClaimModal(); } },
        { title: 'Check My Claim (CLM-CUSTOM-001)', action: () => { toggleCommandPalette(); openClaimWorkspace('CLM-CUSTOM-001'); } },
        { title: 'View My Coverage', action: () => { toggleCommandPalette(); navigateTo('policies'); } },
        { title: 'Missing Documents (1 Required)', action: () => { toggleCommandPalette(); navigateTo('missing-documents'); } },
        { title: 'Account Settings', action: () => { toggleCommandPalette(); navigateTo('settings'); } }
    ];

    items.filter(i => i.title.toLowerCase().includes(q)).forEach(item => {
        const div = document.createElement('div');
        div.style.padding = '10px 14px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid var(--border-soft)';
        div.innerHTML = `<span class="important-value">${item.title}</span>`;
        div.onclick = item.action;
        list.appendChild(div);
    });
}

function closeAllOverlays() {
    closeStartClaimModal();
    hideProcessingModal();
    closeDrawer('drawer-document');
    closeDrawer('drawer-policy');
    document.getElementById('modal-command-palette')?.classList.add('hidden');
}


/* ========================================== */
/* UTILITY HELPERS                            */
/* ========================================== */

function formatRecText(status) {
    if (!status) return 'READY FOR SUBMISSION';
    const s = status.toUpperCase();
    if (s === 'REQUEST_INFORMATION' || s === 'REQ_INFO') return 'MORE INFORMATION NEEDED';
    if (s === 'ESCALATE') return 'MANUAL REVIEW MAY BE REQUIRED';
    if (s === 'REJECT') return 'POTENTIAL COVERAGE ISSUE';
    return 'READY FOR SUBMISSION';
}

function getBadgeClass(status) {
    if (!status) return 'approve';
    const s = status.toUpperCase();
    if (s === 'APPROVE' || s === 'SUPPORTED' || s === 'COMPLETE') return 'approve';
    if (s === 'REQUEST_INFORMATION' || s === 'REQ_INFO' || s === 'WARNING') return 'request';
    if (s === 'ESCALATE' || s === 'UNCERTAIN') return 'escalate';
    if (s === 'REJECT' || s === 'BLOCKED' || s === 'MISSING') return 'reject';
    return 'approve';
}

function addAuditLog(claimId, actionText) {
    state.auditLogs.unshift({
        timestamp: new Date().toLocaleTimeString(),
        claimId: claimId,
        action: actionText
    });
}

function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.innerHTML = `
        <span style="font-weight:600;">${type === 'success' ? '✓' : type === 'warning' ? '!' : 'ℹ'} ${title}:</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
