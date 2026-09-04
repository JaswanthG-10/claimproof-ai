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
    setup3DTiltEffect();
    checkHealth();
});

function initApp() {
    fetchDemoCasesList();
}

async function checkHealth() {
    try {
        const res = await fetch('/health');
        const data = await res.json();
    } catch (e) {
        console.warn('Health check fallback:', e);
    }
}

function setupEventListeners() {
    // Welcome Enter Button
    document.getElementById('enter-workspace-btn')?.addEventListener('click', enterWorkspace);

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

    // Global Click Handler to close dropdown menus
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.more-actions-dropdown')) {
            document.querySelectorAll('.more-actions-menu').forEach(el => el.classList.add('hidden'));
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
/* 3D CARD MOUSE TILT EFFECT                  */
/* ========================================== */

function setup3DTiltEffect() {
    const container = document.getElementById('welcome-screen');
    const card = document.getElementById('welcome-card-3d');
    if (!container || !card) return;

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        const rotateX = (-y / (rect.height / 2)) * 14;
        const rotateY = (x / (rect.width / 2)) * 14;

        card.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    });

    container.addEventListener('mouseleave', () => {
        card.style.transform = `rotateX(0deg) rotateY(0deg)`;
    });
}


/* ========================================== */
/* NAVIGATION & VIEW ROUTER                  */
/* ========================================== */

function enterWorkspace() {
    const welcome = document.getElementById('welcome-screen');
    const shell = document.getElementById('app-shell');

    welcome.style.transition = 'opacity 0.4s ease';
    welcome.style.opacity = '0';

    setTimeout(() => {
        welcome.classList.add('hidden');
        shell.classList.remove('hidden');
        navigateTo('dashboard');
        showToast('Welcome to ClaimProof AI', 'Workspace ready for evidence evaluation.', 'success');
    }, 400);
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

    // Update Breadcrumb header title
    const titles = {
        'dashboard': 'Dashboard',
        'claims': 'Claims List',
        'workspace': 'Claim Review Center',
        'documents': 'Document Library',
        'policies': 'AI Views & Tools',
        'analytics': 'Analytics & KPIs',
        'history': 'Activity History',
        'settings': 'Settings'
    };

    if (titles[viewName]) {
        document.getElementById('breadcrumb-current').innerText = titles[viewName];
    }

    // Refresh view specific data
    if (viewName === 'claims') renderClaimsTable();
    else if (viewName === 'documents') renderDocumentsTable();
    else if (viewName === 'policies') renderPolicyLibrary();
    else if (viewName === 'history') renderAuditTimeline();
}


/* ========================================== */
/* DEMO CASE RUNNER & API INTEGRATION         */
/* ========================================== */

async function fetchDemoCasesList() {
    try {
        const res = await fetch('/api/demo-cases');
        if (res.ok) {
            const data = await res.json();
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

        addAuditLog(data.claim_id, `Analyzed claim package (Suggested Next Step: ${data.recommendation})`);

        if (navigate) {
            setTimeout(() => {
                hideProcessingModal();
                renderWorkspace(data);
                renderDashboardRecentTable();
                navigateTo('workspace');
                showToast('Claim Analysis Complete', `Suggested Next Step: ${formatRecText(data.recommendation)}`, 'success');
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
            showToast('Custom Claim Analyzed', `Suggested Next Step: ${formatRecText(data.recommendation)}`, 'success');
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
    statusBadge.innerText = formatRecText(claim.recommendation);
    statusBadge.className = `badge-pill ${getBadgeClass(claim.recommendation)}`;

    // Left Panel: Uploaded Docs Checklist
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
        div.onclick = () => openDocumentDrawer(`${doc}.pdf`, claim.evidence_items?.find(e => e.source_document.includes(doc))?.raw_text || "Document text content extracted.");
        docList.appendChild(div);
    });

    // Center Panel: Claim Summary Details
    document.getElementById('ws-fact-name').innerText = claim.customer_name || 'Rajesh Sharma';
    document.getElementById('ws-fact-vehicle').innerText = claim.vehicle_number || 'KA01MJ4921';
    document.getElementById('ws-fact-date').innerText = claim.incident_date || '2026-08-21';
    document.getElementById('ws-fact-amount').innerText = claim.claimed_amount ? `INR ${Number(claim.claimed_amount).toLocaleString('en-IN')}` : 'INR 0';

    // Contradictions / Information Mismatch Card
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

    // Missing or Available Documents Checklist
    const compChecklist = document.getElementById('ws-completeness-checklist');
    compChecklist.innerHTML = '';
    const isComplete = claim.completeness?.is_complete;
    document.getElementById('ws-completeness-status').innerText = isComplete ? 'ALL DOCUMENTS SUBMITTED' : 'MISSING DOCUMENTS';
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
            <td><code style="color:#38BDF8; font-weight:bold;">${item.value || 'null'}</code></td>
            <td>${item.source_document}</td>
            <td>Page ${item.page_number}</td>
            <td>${(item.confidence * 100).toFixed(0)}% certain</td>
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
            <div class="p-eval-reason"><strong>Why this clause applies:</strong> ${pa.reasoning}</div>
        `;
        policyGrid.appendChild(card);
    });

    // Right Panel: Recommendation Details
    const recCard = document.getElementById('ws-rec-card');
    const recType = claim.recommendation || 'APPROVE';
    recCard.className = `card-iris-panel recommendation-card ${recType.toLowerCase()}`;
    document.getElementById('ws-rec-title').innerText = formatRecText(recType);

    let summaryText = "";
    let guidanceText = "Review the details above and proceed with your action.";
    if (recType === 'APPROVE') {
        summaryText = "Complete documentation submitted, valid coverage dates, and repair estimate within limit.";
        guidanceText = "Approve the claim package for processing.";
    } else if (recType === 'REQUEST_INFORMATION') {
        summaryText = "Mandatory driving licence document is missing from the submitted claim package.";
        guidanceText = "Request the missing driving licence document from the claimant before proceeding.";
    } else if (recType === 'ESCALATE') {
        summaryText = "Information mismatch detected between Claim Form incident date and Police FIR date.";
        guidanceText = "Escalate to senior review team to verify incident details.";
    } else if (recType === 'REJECT') {
        summaryText = "Vehicle operated as commercial ride-share taxi, triggering Exclusion Clause 4.2.";
        guidanceText = "Reject claim based on commercial vehicle use exclusion.";
    }

    document.getElementById('ws-rec-summary').innerText = summaryText;
    document.getElementById('ws-rec-explanation').innerText = claim.explanation || summaryText;
    document.getElementById('ws-rec-guidance').innerText = guidanceText;

    // Render Guided Actions Hierarchy
    renderGuidedActions(recType);
}


/* ========================================== */
/* GUIDED ACTION HIERARCHY RENDERER (UX FIX)  */
/* ========================================== */

function renderGuidedActions(recommendation) {
    const container = document.getElementById('ws-guided-actions');
    if (!container) return;
    container.innerHTML = '';

    const rec = (recommendation || 'APPROVE').toUpperCase();

    let primary = { label: 'Approve Claim', type: 'APPROVE' };
    let secondary = { label: 'Escalate Review', type: 'ESCALATE' };
    let more = [
        { label: 'Request Information', type: 'REQUEST_INFORMATION' },
        { label: 'Reject Claim', type: 'REJECT' }
    ];

    if (rec === 'REQUEST_INFORMATION' || rec === 'REQ_INFO') {
        primary = { label: 'Request Information', type: 'REQUEST_INFORMATION' };
        secondary = { label: 'Escalate Review', type: 'ESCALATE' };
        more = [
            { label: 'Approve Claim', type: 'APPROVE' },
            { label: 'Reject Claim', type: 'REJECT' }
        ];
    } else if (rec === 'REJECT') {
        primary = { label: 'Reject Claim', type: 'REJECT' };
        secondary = { label: 'Escalate Review', type: 'ESCALATE' };
        more = [
            { label: 'Approve Claim', type: 'APPROVE' },
            { label: 'Request Information', type: 'REQUEST_INFORMATION' }
        ];
    } else if (rec === 'ESCALATE') {
        primary = { label: 'Escalate Review', type: 'ESCALATE' };
        secondary = { label: 'Request Information', type: 'REQUEST_INFORMATION' };
        more = [
            { label: 'Approve Claim', type: 'APPROVE' },
            { label: 'Reject Claim', type: 'REJECT' }
        ];
    }

    const primaryBtn = document.createElement('button');
    primaryBtn.className = 'btn-guided-primary';
    primaryBtn.innerText = `✓ ${primary.label}`;
    primaryBtn.onclick = () => executeDecision(primary.type);

    const secondaryBtn = document.createElement('button');
    secondaryBtn.className = 'btn-guided-secondary';
    secondaryBtn.innerText = secondary.label;
    secondaryBtn.onclick = () => executeDecision(secondary.type);

    const dropdown = document.createElement('div');
    dropdown.className = 'more-actions-dropdown';

    const moreToggle = document.createElement('button');
    moreToggle.className = 'btn-guided-more';
    moreToggle.innerHTML = `More Actions ▾`;

    const menu = document.createElement('div');
    menu.className = 'more-actions-menu hidden';

    more.forEach(item => {
        const itemBtn = document.createElement('button');
        itemBtn.className = 'more-action-item';
        itemBtn.innerText = item.label;
        itemBtn.onclick = (e) => {
            e.stopPropagation();
            menu.classList.add('hidden');
            executeDecision(item.type);
        };
        menu.appendChild(itemBtn);
    });

    moreToggle.onclick = (e) => {
        e.stopPropagation();
        menu.classList.toggle('hidden');
    };

    dropdown.appendChild(moreToggle);
    dropdown.appendChild(menu);

    container.appendChild(primaryBtn);
    container.appendChild(secondaryBtn);
    container.appendChild(dropdown);
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
            <td><span class="status-chip ${getBadgeClass(c.recommendation)}">${formatRecText(c.recommendation)}</span></td>
            <td><span class="badge-pill ${c.completeness?.is_complete ? 'success' : 'warning'}">${c.completeness?.is_complete ? 'Complete' : 'Incomplete'}</span></td>
            <td><button class="btn-link-cyan">Open Review →</button></td>
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
            <td><span class="status-chip ${getBadgeClass(c.recommendation)}">${formatRecText(c.recommendation)}</span></td>
            <td><button class="btn-link-cyan" onclick="openClaimWorkspace('${c.claim_id}')">Open Review</button></td>
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
            <td><button class="btn-link-cyan" onclick="openDocumentDrawer('${e.source_document}', '${e.raw_text || "Text snippet"}')">Preview</button></td>
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
        container.innerHTML = `<p style="font-size:14px; color:#94A3B8;">No review actions recorded yet.</p>`;
        return;
    }

    state.auditLogs.forEach(log => {
        const div = document.createElement('div');
        div.style.padding = '12px 0';
        div.style.borderBottom = '1px solid #1E273A';
        div.innerHTML = `
            <div style="font-size:12px; color:#94A3B8;">${log.timestamp}</div>
            <strong style="font-size:14px; color:#38BDF8;">Claim ${log.claimId}</strong>
            <p style="font-size:14px; color:#F8FAFC; margin-top:2px;">${log.action}</p>
        `;
        container.appendChild(div);
    });
}


/* ========================================== */
/* REVIEW ACTION & ASSISTANT ACTIONS         */
/* ========================================== */

function executeDecision(decisionType) {
    if (!state.activeClaim) return;

    state.activeClaim.recommendation = decisionType;
    addAuditLog(state.activeClaim.claim_id, `Review action executed: ${formatRecText(decisionType)}`);

    renderWorkspace(state.activeClaim);
    renderClaimsTable();
    renderDashboardRecentTable();
    showToast('Action Saved', `Claim ${state.activeClaim.claim_id} updated to ${formatRecText(decisionType)}`, 'success');
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

    let answer = `Regarding "${val}": Claim ${state.activeClaim.claim_id} suggested next step is ${formatRecText(state.activeClaim.recommendation)}.`;
    if (val.includes('flagged') || val.includes('match') || val.includes('contradiction')) {
        const cList = state.activeClaim.contradictions || [];
        answer = cList.length > 0 ? `Flagged due to ${cList.length} information mismatch(es): ${cList.map(c => c.description).join('; ')}` : "No information mismatches detected across submitted documents.";
    } else if (val.includes('clause') || val.includes('policy')) {
        answer = `Evaluated against relevant policy: ${state.activeClaim.policy_assessments?.map(pa => `${pa.clause_id} (${pa.classification})`).join(', ')}`;
    } else if (val.includes('missing')) {
        answer = `Missing required documents: ${state.activeClaim.completeness?.missing_documents?.join(', ') || 'None (all required documents submitted)'}`;
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
    document.getElementById('drawer-doc-content').innerText = text || "Document text layer content loaded.";
    document.getElementById('drawer-document').classList.remove('hidden');
}

function openEvidenceDrawer(item) {
    const body = document.getElementById('drawer-evidence-body');
    body.innerHTML = `
        <div class="fact-item mt-8"><span class="fact-label">Field Name</span><strong class="fact-val">${item.field_name}</strong></div>
        <div class="fact-item mt-8"><span class="fact-label">Extracted Value</span><strong class="fact-val" style="color:#38BDF8;">${item.value}</strong></div>
        <div class="fact-item mt-8"><span class="fact-label">Source Document</span><strong class="fact-val">${item.source_document} (Page ${item.page_number})</strong></div>
        <div class="fact-item mt-8"><span class="fact-label">Certainty Score</span><strong class="fact-val">${(item.confidence * 100).toFixed(0)}% certain</strong></div>
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
        <div class="mt-16"><strong>Why this clause applies:</strong><p style="font-size:13px; color:#CBD5E1; margin-top:4px;">${pa.reasoning}</p></div>
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
        { title: 'Case 2: Missing Driving Licence (NEED MORE INFO)', action: () => runDemoClaimFromModal('claim_002_request_information') },
        { title: 'Case 3: Date Contradiction (ESCALATE)', action: () => runDemoClaimFromModal('claim_003_escalate') },
        { title: 'Case 4: Commercial Ride-share Use (REJECT)', action: () => runDemoClaimFromModal('claim_004_reject') },
        { title: 'Open Policy Library', action: () => { toggleCommandPalette(); navigateTo('policies'); } },
        { title: 'View Activity History Log', action: () => { toggleCommandPalette(); navigateTo('history'); } }
    ];

    items.filter(i => i.title.toLowerCase().includes(q)).forEach(item => {
        const div = document.createElement('div');
        div.className = 'cmd-item';
        div.innerHTML = `<span>${item.title}</span><span style="font-size:12px; color:#94A3B8;">Execute</span>`;
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

function formatRecText(status) {
    if (!status) return 'APPROVE';
    const s = status.toUpperCase();
    if (s === 'REQUEST_INFORMATION' || s === 'REQ_INFO') return 'REQUEST INFORMATION';
    return s.replace('_', ' ');
}

function getBadgeClass(status) {
    if (!status) return 'info';
    const s = status.toUpperCase();
    if (s === 'APPROVE' || s === 'SUPPORTED' || s === 'COMPLETE') return 'approve';
    if (s === 'REQUEST_INFORMATION' || s === 'REQ_INFO' || s === 'WARNING') return 'request';
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
        <span style="font-weight:bold;">${type === 'success' ? '✓' : type === 'warning' ? '⚠️' : 'ℹ️'} ${title}:</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
