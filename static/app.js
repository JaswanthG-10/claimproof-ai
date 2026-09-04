// ==========================================
// CLAIMPROOF AI - APPLICATION CONTROLLER & SPA
// ==========================================

const state = {
    currentView: 'welcome',
    sidebarCollapsed: false,
    activeClaim: null,
    claimsList: [],
    auditLogs: [],
    allPolicies: []
};

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    checkHealth();
});

function initApp() {
    // Populate default synthetic claims into memory for instant responsiveness
    fetchDemoCasesList();
}

async function checkHealth() {
    try {
        const res = await fetch('/health');
        const data = await res.json();
        const statusPill = document.getElementById('server-status-pill');
        if (data.status === 'ok') {
            statusPill.innerHTML = `<span class="dot green"></span> System Ready`;
        }
    } catch (e) {
        console.warn('Health check fallback:', e);
    }
}

function setupEventListeners() {
    // Welcome Enter Button
    document.getElementById('enter-workspace-btn')?.addEventListener('click', enterWorkspace);

    // Sidebar Toggle
    document.getElementById('sidebar-toggle-btn')?.addEventListener('click', toggleSidebar);

    // Sidebar Nav Items
    document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            navigateTo(view);
        });
    });

    // New Claim Modal Triggers
    document.getElementById('sidebar-new-claim-btn')?.addEventListener('click', (e) => { e.preventDefault(); openNewClaimModal(); });
    document.getElementById('header-new-claim-btn')?.addEventListener('click', openNewClaimModal);

    // Keyboard Command Search (Ctrl+K or Cmd+K)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            toggleCommandPalette();
        } else if (e.key === 'Escape') {
            closeAllOverlays();
        }
    });

    document.getElementById('cmd-search-trigger')?.addEventListener('click', toggleCommandPalette);
    document.getElementById('cmd-input')?.addEventListener('input', (e) => handleCmdSearch(e.target.value));

    // Assistant composer input
    document.getElementById('ws-assistant-send-btn')?.addEventListener('click', handleAssistantSubmit);
    document.getElementById('ws-assistant-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAssistantSubmit();
    });
}


/* ========================================== */
/* NAVIGATION & VIEW ROUTER                  */
/* ========================================== */

function enterWorkspace() {
    const welcome = document.getElementById('welcome-screen');
    const shell = document.getElementById('app-shell');

    welcome.style.transition = 'opacity 0.35s ease';
    welcome.style.opacity = '0';

    setTimeout(() => {
        welcome.classList.add('hidden');
        shell.classList.remove('hidden');
        navigateTo('dashboard');
        showToast('Welcome to ClaimProof AI', 'Workspace ready for evidence investigation.', 'success');
    }, 350);
}

function navigateTo(viewName) {
    state.currentView = viewName;

    // Update views visibility
    document.querySelectorAll('.content-view').forEach(el => el.classList.add('hidden'));
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.remove('hidden');

    // Update active nav items
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
        if (el.getAttribute('data-view') === viewName) el.classList.add('active');
        else el.classList.remove('active');
    });

    // Update header title
    const titles = {
        'dashboard': ['Dashboard', 'Overview of your claim investigation workspace'],
        'claims': ['Claims Registry', 'Manage and review motor insurance claim packages'],
        'workspace': ['Claim Review Workspace', 'Interactive evidence review, contradiction check & policy citation'],
        'documents': ['Document Repository', 'Extracted PDF and TXT files organized by document type'],
        'policies': ['Policy Library', 'Motor insurance clauses, exclusions and IDV limits'],
        'analytics': ['Analytics & KPIs', 'Claim approval metrics, missing docs and contradiction trends'],
        'history': ['Audit History', 'Immutable log of claim extractions and investigator actions'],
        'settings': ['Settings', 'Workspace configuration and investigator profile']
    };

    if (titles[viewName]) {
        document.getElementById('header-page-title').innerText = titles[viewName][0];
        document.getElementById('header-page-subtitle').innerText = titles[viewName][1];
    }

    // Refresh view specific data
    if (viewName === 'claims') renderClaimsTable();
    else if (viewName === 'documents') renderDocumentsTable();
    else if (viewName === 'policies') renderPolicyLibrary();
    else if (viewName === 'history') renderAuditTimeline();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    state.sidebarCollapsed = !state.sidebarCollapsed;
    if (state.sidebarCollapsed) sidebar.classList.add('collapsed');
    else sidebar.classList.remove('collapsed');
}


/* ========================================== */
/* DEMO CASE RUNNER & API INTEGRATION         */
/* ========================================== */

async function fetchDemoCasesList() {
    try {
        const res = await fetch('/api/demo-cases');
        if (res.ok) {
            const data = await res.json();
            // Pre-seed first claim
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

        // Add to claims list if absent
        const idx = state.claimsList.findIndex(c => c.claim_id === data.claim_id);
        if (idx >= 0) state.claimsList[idx] = data;
        else state.claimsList.unshift(data);

        // Add audit log
        addAuditLog(data.claim_id, `Analyzed claim package (Recommendation: ${data.recommendation})`);

        if (navigate) {
            setTimeout(() => {
                hideProcessingModal();
                renderWorkspace(data);
                renderDashboardRecentTable();
                navigateTo('workspace');
                showToast('Claim Analysis Complete', `Recommendation generated: ${data.recommendation}`, 'success');
            }, 600);
        } else {
            renderWorkspace(data);
            renderDashboardRecentTable();
        }

    } catch (err) {
        hideProcessingModal();
        showToast('Error', `Failed to analyze claim: ${err.message}`, 'error');
    }
}

function runDemoClaimFromModal(caseId) {
    closeNewClaimModal();
    runDemoClaim(caseId, true);
}

async function handleCustomClaimSubmit(event) {
    event.preventDefault();
    const claimId = document.getElementById('modal-claim-id').value;
    const fileInput = document.getElementById('modal-files');

    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('Warning', 'Please select at least one document file.', 'warning');
        return;
    }

    closeNewClaimModal();
    showProcessingModal();

    const formData = new FormData();
    formData.append('claim_id', claimId);
    for (let i = 0; i < fileInput.files.length; i++) {
        formData.append('files', fileInput.files[i]);
    }

    try {
        const res = await fetch('/api/claims/analyze', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Custom upload error');
        const data = await res.json();

        state.activeClaim = data;
        state.claimsList.unshift(data);
        addAuditLog(claimId, `Uploaded and analyzed custom claim package`);

        setTimeout(() => {
            hideProcessingModal();
            renderWorkspace(data);
            renderDashboardRecentTable();
            navigateTo('workspace');
            showToast('Custom Claim Analyzed', `Recommendation: ${data.recommendation}`, 'success');
        }, 600);

    } catch (e) {
        hideProcessingModal();
        showToast('Error', `Failed custom claim analysis: ${e.message}`, 'error');
    }
}


/* ========================================== */
/* RENDER WORKSPACE & PANELS                  */
/* ========================================== */

function renderWorkspace(claim) {
    if (!claim) return;

    // Header info
    document.getElementById('ws-claim-id').innerText = claim.claim_id;
    document.getElementById('ws-incident-badge').innerText = (claim.incident_type || 'ACCIDENT').toUpperCase();

    const statusBadge = document.getElementById('ws-status-badge');
    statusBadge.innerText = claim.recommendation;
    statusBadge.className = `badge-pill ${getBadgeClass(claim.recommendation)}`;

    // Left Panel: Submitted Docs Checklist
    const docList = document.getElementById('ws-doc-list');
    docList.innerHTML = '';
    const reqDocs = claim.completeness?.required_documents || [];
    const missingDocs = claim.completeness?.missing_documents || [];

    reqDocs.forEach(doc => {
        const isMissing = missingDocs.includes(doc);
        const div = document.createElement('div');
        div.className = `doc-check-item ${isMissing ? 'missing' : 'complete'}`;
        div.innerHTML = `
            <span>${isMissing ? '❌' : '✅'}</span>
            <strong>${doc.replace('_', ' ').toUpperCase()}</strong>
        `;
        div.onclick = () => openDocumentDrawer(`${doc}.pdf`, claim.evidence_items?.find(e => e.source_document.includes(doc))?.raw_text || "Document text content extracted from PyMuPDF.");
        docList.appendChild(div);
    });

    // Center Panel: Facts Overview
    document.getElementById('ws-fact-name').innerText = claim.customer_name || 'Rajesh Sharma';
    document.getElementById('ws-fact-vehicle').innerText = claim.vehicle_number || 'KA01MJ4921';
    document.getElementById('ws-fact-date').innerText = claim.incident_date || '2026-08-21';
    document.getElementById('ws-fact-amount').innerText = claim.claimed_amount ? `INR ${Number(claim.claimed_amount).toLocaleString('en-IN')}` : 'INR 0';

    // Contradictions Card
    const cCard = document.getElementById('ws-contradiction-card');
    const cContainer = document.getElementById('ws-contradictions-container');
    const contradictions = claim.contradictions || [];

    if (contradictions.length > 0) {
        cCard.classList.remove('hidden');
        cContainer.innerHTML = '';
        contradictions.forEach(c => {
            const box = document.createElement('div');
            box.className = 'contradiction-item';
            box.innerHTML = `
                <div class="c-title">⚠️ ${c.field_name.replace('_', ' ').toUpperCase()} MISMATCH</div>
                <div class="c-desc">${c.description}</div>
                <div class="c-sources-grid">
                    <div class="c-source-box"><strong>${c.source_a} (P.${c.page_a}):</strong> ${c.value_a}</div>
                    <div class="c-source-box"><strong>${c.source_b} (P.${c.page_b}):</strong> ${c.value_b}</div>
                </div>
            `;
            cContainer.appendChild(box);
        });
    } else {
        cCard.classList.add('hidden');
    }

    // Completeness Checklist Pills
    const compChecklist = document.getElementById('ws-completeness-checklist');
    compChecklist.innerHTML = '';
    const isComplete = claim.completeness?.is_complete;
    document.getElementById('ws-completeness-status').innerText = isComplete ? 'COMPLETE' : 'INCOMPLETE';
    document.getElementById('ws-completeness-status').className = `badge-pill ${isComplete ? 'success' : 'danger'}`;

    reqDocs.forEach(d => {
        const isMissing = missingDocs.includes(d);
        const span = document.createElement('span');
        span.className = `status-chip ${isMissing ? 'reject' : 'approve'}`;
        span.innerText = `${isMissing ? 'Missing:' : '✓'} ${d.replace('_', ' ')}`;
        compChecklist.appendChild(span);
    });

    // Evidence Matrix Table
    const evTbody = document.getElementById('ws-evidence-table-body');
    evTbody.innerHTML = '';
    (claim.evidence_items || []).forEach(item => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => openEvidenceDrawer(item);
        tr.innerHTML = `
            <td><strong>${item.field_name}</strong></td>
            <td><code style="color:#4f46e5;">${item.value || 'null'}</code></td>
            <td>${item.source_document}</td>
            <td>Page ${item.page_number}</td>
            <td>${(item.confidence * 100).toFixed(0)}%</td>
        `;
        evTbody.appendChild(tr);
    });

    // Policy Clauses Grid
    const policyGrid = document.getElementById('ws-policy-clauses-list');
    policyGrid.innerHTML = '';
    (claim.policy_assessments || []).forEach(pa => {
        const card = document.createElement('div');
        card.className = `policy-eval-card ${pa.classification}`;
        card.onclick = () => openPolicyDrawer(pa);
        card.innerHTML = `
            <div class="p-eval-head">
                <span class="p-eval-title">${pa.clause_id} - ${pa.clause_title} (Page ${pa.page})</span>
                <span class="status-chip ${getBadgeClass(pa.classification)}">${pa.classification}</span>
            </div>
            <div class="p-eval-text">"${pa.clause_text}"</div>
            <div class="p-eval-reason"><strong>Grounding Reason:</strong> ${pa.reasoning}</div>
        `;
        policyGrid.appendChild(card);
    });

    // Right Panel: Recommendation Card
    const recCard = document.getElementById('ws-rec-card');
    const recType = claim.recommendation || 'APPROVE';
    recCard.className = `card-panel recommendation-card ${recType.toLowerCase()}`;
    document.getElementById('ws-rec-title').innerText = recType.replace('_', ' ');

    let summaryText = "";
    if (recType === 'APPROVE') summaryText = "Complete evidence, valid policy coverage & limits verified.";
    else if (recType === 'REQUEST_INFORMATION') summaryText = "Mandatory required driving licence document missing.";
    else if (recType === 'ESCALATE') summaryText = "Material date contradiction between Claim Form & FIR.";
    else if (recType === 'REJECT') summaryText = "Prohibited commercial ride-share taxi use triggered Section 4.2 Exclusion.";

    document.getElementById('ws-rec-summary').innerText = summaryText;
    document.getElementById('ws-rec-explanation').innerText = claim.explanation || summaryText;
}


/* ========================================== */
/* DASHBOARD & TABLES RENDERERS               */
/* ========================================== */

function renderDashboardRecentTable() {
    const tbody = document.getElementById('dashboard-recent-claims-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    state.claimsList.slice(0, 5).forEach(c => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => { state.activeClaim = c; renderWorkspace(c); navigateTo('workspace'); };
        tr.innerHTML = `
            <td><strong>${c.claim_id}</strong></td>
            <td>${c.customer_name} (${c.vehicle_number})</td>
            <td>${(c.incident_type || 'Accident').toUpperCase()}</td>
            <td>INR ${Number(c.claimed_amount || 0).toLocaleString('en-IN')}</td>
            <td><span class="status-chip ${getBadgeClass(c.recommendation)}">${c.recommendation}</span></td>
            <td><span class="badge-pill ${c.completeness?.is_complete ? 'success' : 'warning'}">${c.completeness?.is_complete ? 'Complete' : 'Incomplete'}</span></td>
            <td><button class="btn-ghost-sm">Review Workspace →</button></td>
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
            <td>${c.customer_name}</td>
            <td>${c.vehicle_number}</td>
            <td>${(c.incident_type || 'Accident').toUpperCase()}</td>
            <td>${c.incident_date}</td>
            <td>INR ${Number(c.claimed_amount || 0).toLocaleString('en-IN')}</td>
            <td><span class="status-chip ${getBadgeClass(c.recommendation)}">${c.recommendation}</span></td>
            <td><button class="btn-secondary-sm" onclick="openClaimWorkspace('${c.claim_id}')">Inspect</button></td>
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

    if (!state.activeClaim) return;

    (state.activeClaim.evidence_items || []).forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${e.source_document}</strong></td>
            <td><span class="badge-pill info">${e.field_name.toUpperCase()}</span></td>
            <td>${state.activeClaim.claim_id}</td>
            <td>Page ${e.page_number}</td>
            <td><span class="badge-pill success">Extracted</span></td>
            <td><button class="btn-ghost-sm" onclick="openDocumentDrawer('${e.source_document}', '${e.raw_text || "Text snippet"}')">Preview</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPolicyLibrary() {
    const grid = document.getElementById('policy-library-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const defaultClauses = state.activeClaim?.policy_assessments || [];
    defaultClauses.forEach(c => {
        const div = document.createElement('div');
        div.className = 'policy-eval-card';
        div.innerHTML = `
            <div class="p-eval-head">
                <span class="p-eval-title">${c.clause_id} - ${c.clause_title} (Page ${c.page})</span>
                <span class="badge-pill info">${c.category.toUpperCase()}</span>
            </div>
            <div class="p-eval-text">"${c.clause_text}"</div>
        `;
        grid.appendChild(div);
    });
}

function renderAuditTimeline() {
    const container = document.getElementById('audit-timeline');
    if (!container) return;
    container.innerHTML = '';

    if (state.auditLogs.length === 0) {
        container.innerHTML = `<p style="font-size:0.85rem; color:#64748b;">No investigator decisions recorded yet.</p>`;
        return;
    }

    state.auditLogs.forEach(log => {
        const div = document.createElement('div');
        div.style.padding = '12px';
        div.style.borderBottom = '1px solid #e2e8f0';
        div.innerHTML = `
            <div style="font-size:0.75rem; color:#94a3b8;">${log.timestamp}</div>
            <strong style="font-size:0.88rem; color:#4f46e5;">Claim ${log.claimId}</strong>
            <p style="font-size:0.82rem; color:#0f172a;">${log.action}</p>
        `;
        container.appendChild(div);
    });
}


/* ========================================== */
/* INVESTIGATOR DECISION & ASSISTANT ACTIONS  */
/* ========================================== */

function executeDecision(decisionType) {
    if (!state.activeClaim) return;

    state.activeClaim.recommendation = decisionType;
    addAuditLog(state.activeClaim.claim_id, `Investigator executed final decision: ${decisionType}`);

    renderWorkspace(state.activeClaim);
    renderClaimsTable();
    showToast('Decision Saved', `Claim ${state.activeClaim.claim_id} updated to ${decisionType}`, 'success');
}

function askAssistant(queryText) {
    document.getElementById('ws-assistant-input').value = queryText;
    handleAssistantSubmit();
}

function handleAssistantSubmit() {
    const input = document.getElementById('ws-assistant-input');
    const val = input.value.trim();
    if (!val || !state.activeClaim) return;

    input.value = '';

    let answer = `Regarding "${val}": Claim ${state.activeClaim.claim_id} recommendation is ${state.activeClaim.recommendation}.`;
    if (val.includes('flagged') || val.includes('contradiction')) {
        const cList = state.activeClaim.contradictions || [];
        answer = cList.length > 0 ? `Flagged due to ${cList.length} contradiction(s): ${cList.map(c => c.description).join('; ')}` : "No material factual contradictions detected in submitted documents.";
    } else if (val.includes('clause') || val.includes('policy')) {
        answer = `Evaluated against policy: ${state.activeClaim.policy_assessments?.map(pa => `${pa.clause_id} (${pa.classification})`).join(', ')}`;
    } else if (val.includes('missing')) {
        answer = `Missing mandatory documents: ${state.activeClaim.completeness?.missing_documents?.join(', ') || 'None (all required docs submitted)'}`;
    }

    showToast('ClaimProof Assistant', answer, 'info');
}


/* ========================================== */
/* MODALS, DRAWERS & OVERLAYS                */
/* ========================================== */

function openNewClaimModal() {
    document.getElementById('modal-new-claim').classList.remove('hidden');
}

function closeNewClaimModal() {
    document.getElementById('modal-new-claim').classList.add('hidden');
}

function showProcessingModal() {
    document.getElementById('modal-processing').classList.remove('hidden');
}

function hideProcessingModal() {
    document.getElementById('modal-processing').classList.add('hidden');
}

function openDocumentDrawer(filename, text) {
    document.getElementById('drawer-doc-filename').innerText = filename;
    document.getElementById('drawer-doc-content').innerText = text || "PyMuPDF document text layer content loaded.";
    document.getElementById('drawer-document').classList.remove('hidden');
}

function openEvidenceDrawer(item) {
    const body = document.getElementById('drawer-evidence-body');
    body.innerHTML = `
        <div class="fact-item mt-8"><span class="fact-label">Field Name</span><strong class="fact-val">${item.field_name}</strong></div>
        <div class="fact-item mt-8"><span class="fact-label">Extracted Value</span><strong class="fact-val" style="color:#4f46e5;">${item.value}</strong></div>
        <div class="fact-item mt-8"><span class="fact-label">Source Document</span><strong class="fact-val">${item.source_document} (Page ${item.page_number})</strong></div>
        <div class="fact-item mt-8"><span class="fact-label">Confidence Score</span><strong class="fact-val">${(item.confidence * 100).toFixed(0)}%</strong></div>
        <div class="doc-text-content mt-12">Raw Text Snippet:\n"${item.raw_text || item.value}"</div>
    `;
    document.getElementById('drawer-evidence').classList.remove('hidden');
}

function openPolicyDrawer(pa) {
    document.getElementById('drawer-policy-id').innerText = `${pa.clause_id} - ${pa.clause_title}`;
    const body = document.getElementById('drawer-policy-body');
    body.innerHTML = `
        <span class="badge-pill info">Page ${pa.page}</span>
        <span class="status-chip ${getBadgeClass(pa.classification)}">${pa.classification}</span>
        <div class="doc-text-content mt-12">"${pa.clause_text}"</div>
        <div class="mt-16"><strong>Investigator Grounding:</strong><p style="font-size:0.85rem; color:#64748b; margin-top:4px;">${pa.reasoning}</p></div>
    `;
    document.getElementById('drawer-policy').classList.remove('hidden');
}

function closeDrawer(id) {
    document.getElementById(id)?.classList.add('hidden');
}

function toggleCommandPalette() {
    const modal = document.getElementById('modal-command-palette');
    const isHidden = modal.classList.contains('hidden');
    if (isHidden) {
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
        { title: 'Case 1: Standard Accident (APPROVE)', action: () => runDemoClaimFromModal('claim_001_approve') },
        { title: 'Case 2: Missing Driving Licence (REQ INFO)', action: () => runDemoClaimFromModal('claim_002_request_information') },
        { title: 'Case 3: Date Contradiction (ESCALATE)', action: () => runDemoClaimFromModal('claim_003_escalate') },
        { title: 'Case 4: Commercial Ride-share Use (REJECT)', action: () => runDemoClaimFromModal('claim_004_reject') },
        { title: 'Open Policy Library', action: () => { toggleCommandPalette(); navigateTo('policies'); } },
        { title: 'View Audit History Log', action: () => { toggleCommandPalette(); navigateTo('history'); } }
    ];

    items.filter(i => i.title.toLowerCase().includes(q)).forEach(item => {
        const div = document.createElement('div');
        div.className = 'cmd-item';
        div.innerHTML = `<span>${item.title}</span><span style="font-size:0.75rem; color:#94a3b8;">Execute</span>`;
        div.onclick = item.action;
        list.appendChild(div);
    });
}

function closeAllOverlays() {
    closeNewClaimModal();
    hideProcessingModal();
    closeDrawer('drawer-document');
    closeDrawer('drawer-evidence');
    closeDrawer('drawer-policy');
    document.getElementById('modal-command-palette').classList.add('hidden');
}


/* ========================================== */
/* UTILITY HELPERS                            */
/* ========================================== */

function getBadgeClass(status) {
    if (!status) return 'info';
    const s = status.toUpperCase();
    if (s === 'APPROVE' || s === 'SUPPORTED' || s === 'COMPLETE') return 'approve';
    if (s === 'REQUEST_INFORMATION' || s === 'WARNING') return 'request';
    if (s === 'ESCALATE' || s === 'UNCERTAIN') return 'escalate';
    if (s === 'REJECT' || s === 'BLOCKED' || s === 'MISSING') return 'reject';
    return 'info';
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
        <span style="font-weight:700;">${type === 'success' ? '✓' : type === 'warning' ? '⚠️' : 'ℹ️'} ${title}:</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
