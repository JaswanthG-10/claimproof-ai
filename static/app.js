// ==========================================
// CLAIMPROOF AI - SMART CLAIM CHECKER CONTROLLER
// ==========================================

const state = {
    currentView: 'dashboard',
    sidebarCollapsed: false,
    activeClaim: null,
    claimsList: [],
    auditLogs: [],
    allPolicies: [],
    investigatorName: 'Jaswanth G.',
    policyNumber: 'POL-2026-88492',
    policyFilter: 'all'
};

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    init3DScene();
    checkHealth();
});

function initApp() {
    fetchDemoCasesList();
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
    // Login Form Submit (Credential-less)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    // Sidebar Nav Items (Exact User Structure)
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

    // Assistant Composer Input
    document.getElementById('ws-assistant-send-btn')?.addEventListener('click', handleAssistantSubmit);
    document.getElementById('ws-assistant-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAssistantSubmit();
    });
}


/* ========================================== */
/* THREE.JS 3D VIOLET GRAPH VISUALIZATION     */
/* ========================================== */

let scene, camera, renderer, nodesGroup;
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;

function init3DScene() {
    const canvas = document.getElementById('canvas-3d');
    if (!canvas || typeof THREE === 'undefined') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const container = canvas.parentElement;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 700;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x09040E, 0.035);

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 24;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    nodesGroup = new THREE.Group();
    scene.add(nodesGroup);

    // Violet Node Network Pipeline: Upload Docs -> Extract Evidence -> Verify Coverage -> AI Decision
    const stages = [
        { label: 'Upload Docs', x: -9, color: 0xE879F9, count: 4 },
        { label: 'Extract Evidence', x: -3, color: 0xA855F7, count: 6 },
        { label: 'Verify Coverage', x: 3, color: 0x9333EA, count: 5 },
        { label: 'AI Decision', x: 9, color: 0x22C55E, count: 3 }
    ];

    const nodePositions = [];
    const sphereGeo = new THREE.SphereGeometry(0.38, 16, 16);

    stages.forEach(stage => {
        const stageNodes = [];
        for (let i = 0; i < stage.count; i++) {
            const y = (i - (stage.count - 1) / 2) * 2.6 + (Math.random() - 0.5) * 0.4;
            const z = (Math.random() - 0.5) * 3;

            const mat = new THREE.MeshBasicMaterial({ color: stage.color });
            const mesh = new THREE.Mesh(sphereGeo, mat);
            mesh.position.set(stage.x, y, z);
            nodesGroup.add(mesh);

            const haloGeo = new THREE.SphereGeometry(0.6, 12, 12);
            const haloMat = new THREE.MeshBasicMaterial({
                color: stage.color,
                transparent: true,
                opacity: 0.25,
                wireframe: true
            });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.position.set(stage.x, y, z);
            nodesGroup.add(halo);

            stageNodes.push({ x: stage.x, y, z, mesh, color: stage.color });
        }
        nodePositions.push(stageNodes);
    });

    // Violet Connecting Lines
    const lineMat = new THREE.LineBasicMaterial({
        color: 0xA855F7,
        transparent: true,
        opacity: 0.4
    });

    for (let s = 0; s < nodePositions.length - 1; s++) {
        const currStage = nodePositions[s];
        const nextStage = nodePositions[s + 1];

        currStage.forEach(n1 => {
            nextStage.forEach(n2 => {
                if (Math.random() > 0.45) return;
                const points = [
                    new THREE.Vector3(n1.x, n1.y, n1.z),
                    new THREE.Vector3((n1.x + n2.x) / 2, (n1.y + n2.y) / 2 + (Math.random() - 0.5) * 1.5, (n1.z + n2.z) / 2 + (Math.random() - 0.5) * 1.5),
                    new THREE.Vector3(n2.x, n2.y, n2.z)
                ];
                const curve = new THREE.CatmullRomCurve3(points);
                const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));
                const line = new THREE.Line(geometry, lineMat);
                nodesGroup.add(line);
            });
        });
    }

    // Ambient Violet Floating Particles
    const particleCount = 140;
    const particleGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 28;
        posArray[i + 1] = (Math.random() - 0.5) * 18;
        posArray[i + 2] = (Math.random() - 0.5) * 14;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
        size: 0.09,
        color: 0xE879F9,
        transparent: true,
        opacity: 0.6
    });
    nodesGroup.add(new THREE.Points(particleGeo, particleMat));

    // Mouse Parallax Listener
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    window.addEventListener('resize', () => {
        if (!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    if (prefersReducedMotion) {
        renderer.render(scene, camera);
        return;
    }

    let clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        targetX = mouseX * 0.8;
        targetY = mouseY * 0.8;

        nodesGroup.rotation.y += 0.0015;
        nodesGroup.rotation.x = Math.sin(elapsedTime * 0.4) * 0.04 + targetY * 0.1;
        nodesGroup.rotation.y += (targetX * 0.1 - nodesGroup.rotation.y) * 0.05;

        particleMat.opacity = 0.4 + Math.sin(elapsedTime * 1.5) * 0.25;
        renderer.render(scene, camera);
    }
    animate();
}


/* ========================================== */
/* CREDENTIAL-LESS LOGIN HANDLER              */
/* ========================================== */

function handleLoginSubmit(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('login-submit-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span style="display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:8px; vertical-align:middle;"></span> Opening Workspace...`;
    }

    setTimeout(() => {
        enterWorkspace();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `Enter Workspace →`;
        }
    }, 350);
}

function enterWorkspace() {
    const welcome = document.getElementById('welcome-screen');
    const shell = document.getElementById('app-shell');

    welcome.style.transition = 'opacity 0.35s ease';
    welcome.style.opacity = '0';

    setTimeout(() => {
        welcome.classList.add('hidden');
        shell.classList.remove('hidden');
        navigateTo('dashboard');
        showToast('Welcome Jaswanth G.', 'Smart Claim Checker ready.', 'success');
    }, 350);
}


/* ========================================== */
/* VIEW ROUTER                                */
/* ========================================== */

function navigateTo(viewName) {
    state.currentView = viewName;

    // Hide all views & show active
    document.querySelectorAll('.content-view').forEach(el => el.classList.add('hidden'));
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.remove('hidden');

    // Update active sidebar nav
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
        if (el.getAttribute('data-view') === viewName) el.classList.add('active');
        else el.classList.remove('active');
    });

    // Breadcrumb Update
    const titles = {
        'dashboard': 'Home',
        'my-claims': 'My Claims',
        'workspace': 'AI Claim Check',
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

    // Refresh View Renderers
    if (viewName === 'my-claims') renderClaimsTable();
    else if (viewName === 'documents') renderDocumentsTable();
    else if (viewName === 'policies') renderPolicyLibrary();
}


/* ========================================== */
/* DEMO CASES RUNNER & API INTEGRATION        */
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

        addAuditLog(data.claim_id, `AI Evidence Check Completed: ${data.recommendation}`);

        if (navigate) {
            setTimeout(() => {
                hideProcessingModal();
                renderWorkspace(data);
                renderDashboardRecentTable();
                navigateTo('workspace');
                showToast('AI Check Complete', `Decision: ${formatRecText(data.recommendation)}`, 'success');
            }, 600);
        } else {
            renderWorkspace(data);
            renderDashboardRecentTable();
        }

    } catch (err) {
        hideProcessingModal();
        showToast('Error', `Failed AI claim check: ${err.message}`, 'error');
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

        setTimeout(() => {
            hideProcessingModal();
            renderWorkspace(data);
            renderDashboardRecentTable();
            navigateTo('workspace');
            showToast('Custom Claim Checked', `Decision: ${formatRecText(data.recommendation)}`, 'success');
        }, 600);

    } catch (e) {
        hideProcessingModal();
        showToast('Error', `Failed custom claim check: ${e.message}`, 'error');
    }
}


/* ========================================== */
/* RENDER WORKSPACE & AI DECISION OUTCOME     */
/* ========================================== */

function renderWorkspace(claim) {
    if (!claim) return;

    // Header info
    document.getElementById('ws-claim-id').innerText = claim.claim_id;
    document.getElementById('ws-incident-badge').innerText = claim.incident_type ? claim.incident_type.charAt(0).toUpperCase() + claim.incident_type.slice(1) : 'Accident';

    const statusBadge = document.getElementById('ws-status-badge');
    statusBadge.innerText = formatRecText(claim.recommendation);
    statusBadge.className = `badge-status ${getBadgeClass(claim.recommendation)}`;

    // AI DECISION OUTCOME BANNER (Approved vs Not Approved with Reason & Try Again)
    const decisionBanner = document.getElementById('user-ai-decision-banner');
    const bannerIcon = document.getElementById('banner-icon-box');
    const bannerTitle = document.getElementById('banner-decision-title');
    const bannerReason = document.getElementById('banner-decision-reason');
    const bannerActionBox = document.getElementById('banner-action-box');

    const recType = (claim.recommendation || 'APPROVE').toUpperCase();

    if (recType === 'APPROVE') {
        decisionBanner.className = 'ai-decision-banner approved glass-card';
        bannerIcon.innerText = '✓';
        bannerTitle.innerText = 'APPROVED - READY FOR PAYOUT';
        bannerReason.innerText = 'All required documents submitted, dates verified, and repair estimate within policy limits.';
        bannerActionBox.innerHTML = `<button class="btn-primary btn-glass-glow" onclick="showToast('Payout Initiated', 'Payout settlement of ₹${Number(claim.claimed_amount || 48750).toLocaleString('en-IN')} initiated to your account.', 'success')">Proceed to Payout →</button>`;
    } else {
        decisionBanner.className = 'ai-decision-banner rejected glass-card';
        bannerIcon.innerText = '✕';
        
        let reasonMsg = "Document completeness or policy rule violation detected.";
        if (recType === 'REQUEST_INFORMATION' || recType === 'REQ_INFO') {
            bannerTitle.innerText = 'ACTION REQUIRED — MISSING DOCUMENT';
            reasonMsg = "Mandatory Driving Licence document is missing from your claim submission.";
        } else if (recType === 'ESCALATE') {
            bannerTitle.innerText = 'UNDER REVIEW — DATE CONTRADICTION DETECTED';
            reasonMsg = "Incident date on Claim Form (Aug 21) does not match Police FIR date (Aug 22).";
        } else if (recType === 'REJECT') {
            bannerTitle.innerText = 'CLAIM REJECTED — EXCLUSION CLAUSE TRIGGERED';
            reasonMsg = "Vehicle operated for commercial ride-share taxi use, triggering Exclusion Clause 4.2.";
        }

        bannerReason.innerText = reasonMsg;
        bannerActionBox.innerHTML = `<button class="btn-primary btn-glass-glow" onclick="openNewClaimModal()">Try Again / Upload Document ↺</button>`;
    }

    // Left Panel: Document Checklist
    const reqDocs = claim.completeness?.required_documents || [];
    const missingDocs = claim.completeness?.missing_documents || [];
    const availableDocs = reqDocs.filter(d => !missingDocs.includes(d));

    const missingList = document.getElementById('ws-doc-missing-list');
    const availList = document.getElementById('ws-doc-available-list');
    missingList.innerHTML = '';
    availList.innerHTML = '';

    const recCount = availableDocs.length + 1;
    document.getElementById('ws-doc-counter').innerText = `${recCount} / 5 received`;

    if (missingDocs.length > 0) {
        missingDocs.forEach(doc => {
            const div = document.createElement('div');
            div.className = 'doc-status-row missing';
            div.style.padding = '8px 12px';
            div.style.background = 'rgba(239,68,68,0.1)';
            div.style.border = '1px solid rgba(239,68,68,0.3)';
            div.style.borderRadius = '8px';
            div.style.marginTop = '6px';
            div.innerHTML = `
                <span style="color:#F87171; font-weight:700;">✕ ${doc.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                <span class="badge-status danger" style="margin-left:auto;">Missing</span>
            `;
            missingList.appendChild(div);
        });
    } else {
        missingList.innerHTML = `<div class="metadata-text" style="color:#22C55E; padding:8px;">✓ All required documents submitted.</div>`;
    }

    // Policy document row
    const policyRow = document.createElement('div');
    policyRow.className = 'doc-status-row';
    policyRow.style.padding = '8px 12px';
    policyRow.style.background = 'rgba(25,15,46,0.6)';
    policyRow.style.border = '1px solid var(--border-glass)';
    policyRow.style.borderRadius = '8px';
    policyRow.style.marginTop = '6px';
    policyRow.innerHTML = `
        <span style="color:#FFFFFF; font-weight:700;">✓ Policy Document</span>
        <span class="badge-neutral" style="margin-left:auto;">Indexed</span>
    `;
    policyRow.onclick = () => navigateTo('policies');
    availList.appendChild(policyRow);

    availableDocs.forEach(doc => {
        const div = document.createElement('div');
        div.className = 'doc-status-row';
        div.style.padding = '8px 12px';
        div.style.background = 'rgba(25,15,46,0.6)';
        div.style.border = '1px solid var(--border-glass)';
        div.style.borderRadius = '8px';
        div.style.marginTop = '6px';
        div.innerHTML = `
            <span style="color:#FFFFFF; font-weight:700;">✓ ${doc.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
            <span class="badge-status approve" style="margin-left:auto;">Verified</span>
        `;
        div.onclick = () => openDocumentDrawer(`${doc}.pdf`, claim.evidence_items?.find(e => e.source_document.includes(doc))?.raw_text || "Document text content.");
        availList.appendChild(div);
    });

    // Center Panel: Structured Claim Summary Grid
    document.getElementById('ws-fact-name').innerText = claim.customer_name || 'Arjun Mehta';
    document.getElementById('ws-fact-vehicle').innerText = claim.vehicle_number || 'TN00DM2026';
    document.getElementById('ws-fact-date').innerText = claim.incident_date || 'Not specified';
    document.getElementById('ws-fact-amount').innerText = claim.claimed_amount ? `₹${Number(claim.claimed_amount).toLocaleString('en-IN')}` : '₹48,750';

    // Contradictions Cards
    const cCard = document.getElementById('ws-contradiction-card');
    const cContainer = document.getElementById('ws-contradictions-container');
    const contradictions = claim.contradictions || [];

    if (contradictions.length > 0) {
        cCard.classList.remove('hidden');
        document.getElementById('ws-issues-count-badge').innerText = `⚠ ${contradictions.length} Issues`;
        cContainer.innerHTML = '';

        contradictions.forEach(c => {
            const card = document.createElement('div');
            card.className = 'issue-card';
            card.innerHTML = `
                <div class="issue-card-top">
                    <span class="issue-title">⚠ ${c.field_name.replace('_', ' ').toUpperCase()} MISMATCH</span>
                    <span class="badge-status danger">HIGH RISK</span>
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

    // Extracted Evidence Table
    const evTbody = document.getElementById('ws-evidence-table-body');
    evTbody.innerHTML = '';
    (claim.evidence_items || []).slice(0, 6).forEach(item => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => openEvidenceDrawer(item);
        tr.innerHTML = `
            <td><strong>${item.field_name}</strong></td>
            <td><code style="color:#E879F9; font-weight:700;">${item.value || 'null'}</code></td>
            <td>${item.source_document}</td>
            <td>${(item.confidence * 100).toFixed(0)}% certain</td>
        `;
        evTbody.appendChild(tr);
    });

    // Policy Clauses Grid
    const policyGrid = document.getElementById('ws-policy-clauses-list');
    policyGrid.innerHTML = '';
    (claim.policy_assessments || []).forEach(pa => {
        const card = document.createElement('div');
        card.className = 'policy-clause-card glass-card p-12 mt-8';
        card.onclick = () => openPolicyDrawer(pa);
        card.innerHTML = `
            <div class="clause-card-top flex-between">
                <span class="clause-id-title" style="font-weight:700; color:#FFFFFF;">${pa.clause_id} · ${pa.clause_title}</span>
                <span class="badge-status ${getBadgeClass(pa.classification)}">${pa.classification}</span>
            </div>
            <div class="clause-text-snippet mt-4" style="font-size:12px; color:#E9D5FF;">"${pa.clause_text}"</div>
        `;
        policyGrid.appendChild(card);
    });

    // Right Panel: Recommendation Details
    const recCard = document.getElementById('ws-rec-card');
    recCard.className = `card-enterprise recommendation-panel ${recType.toLowerCase()} glass-card`;
    document.getElementById('ws-rec-title').innerText = formatRecText(recType);

    let summaryText = "";
    let guidanceText = "Review verified details and proceed with recommended review action.";
    if (recType === 'APPROVE') {
        summaryText = "Complete documentation submitted, valid coverage dates, and repair estimate within limit.";
        guidanceText = "Claim verified and eligible for immediate payout.";
    } else if (recType === 'REQUEST_INFORMATION') {
        summaryText = "Mandatory driving licence document is missing from your claim submission.";
        guidanceText = "Upload your driving licence to complete claim verification.";
    } else if (recType === 'ESCALATE') {
        summaryText = "Information mismatch detected between Claim Form incident date and Police FIR date.";
        guidanceText = "Submit clarifying incident statement or updated FIR document.";
    } else if (recType === 'REJECT') {
        summaryText = "Vehicle operated as commercial ride-share taxi, triggering Exclusion Clause 4.2.";
        guidanceText = "Claim non-payable due to commercial vehicle exclusion clause.";
    }

    document.getElementById('ws-rec-summary').innerText = summaryText;
    document.getElementById('ws-rec-explanation').innerText = claim.explanation || summaryText;
    document.getElementById('ws-rec-guidance').innerText = guidanceText;

    renderGuidedActions(recType);
}


function renderGuidedActions(recommendation) {
    const container = document.getElementById('ws-guided-actions');
    if (!container) return;
    container.innerHTML = '';

    const rec = (recommendation || 'APPROVE').toUpperCase();

    if (rec === 'APPROVE') {
        const btn = document.createElement('button');
        btn.className = 'btn-primary full-width btn-glass-glow';
        btn.innerText = 'Proceed to Payout Settlement →';
        btn.onclick = () => showToast('Payout Initiated', 'Payout settlement initiated.', 'success');
        container.appendChild(btn);
    } else {
        const btn = document.createElement('button');
        btn.className = 'btn-primary full-width btn-glass-glow';
        btn.innerText = 'Try Again / Upload Document ↺';
        btn.onclick = openNewClaimModal;
        container.appendChild(btn);
    }
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
            <td>${c.vehicle_number}</td>
            <td>${c.incident_type ? c.incident_type.toUpperCase() : 'ACCIDENT'}</td>
            <td>₹${Number(c.claimed_amount || 48750).toLocaleString('en-IN')}</td>
            <td><span class="status-badge ${getBadgeClass(c.recommendation)}">${formatRecText(c.recommendation)}</span></td>
            <td><button class="btn-tertiary-link">View Check →</button></td>
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
            <td>${c.incident_type ? c.incident_type.toUpperCase() : 'ACCIDENT'}</td>
            <td>${c.incident_date}</td>
            <td>₹${Number(c.claimed_amount || 48750).toLocaleString('en-IN')}</td>
            <td><span class="status-badge ${getBadgeClass(c.recommendation)}">${formatRecText(c.recommendation)}</span></td>
            <td><button class="btn-tertiary-link" onclick="openClaimWorkspace('${c.claim_id}')">View Check</button></td>
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

// RENDER IMPORTED DOCUMENTS ONLY (NO GRANULAR TOKEN EXTRACTIONS!)
function renderDocumentsTable() {
    const tbody = document.getElementById('documents-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Sample Imported Document Files list
    const importedFiles = [
        { name: 'Claim_Form_Arjun_Mehta.pdf', type: 'Claim Form', claimId: 'CLM-001', size: '1.2 MB / 2 Pages', status: 'Imported' },
        { name: 'Police_FIR_Report_2026.pdf', type: 'Police FIR', claimId: 'CLM-001', size: '850 KB / 1 Page', status: 'Imported' },
        { name: 'Repair_Estimate_Invoice.pdf', type: 'Repair Estimate', claimId: 'CLM-001', size: '620 KB / 1 Page', status: 'Imported' },
        { name: 'Vehicle_Photos_Damage.pdf', type: 'Vehicle Photos', claimId: 'CLM-001', size: '3.4 MB / 4 Pages', status: 'Imported' }
    ];

    importedFiles.forEach(file => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${file.name}</strong></td>
            <td><span class="badge-neutral">${file.type}</span></td>
            <td>${file.claimId}</td>
            <td>${file.size}</td>
            <td><span class="status-badge approve">✓ ${file.status}</span></td>
            <td><button class="btn-tertiary-link" onclick="openDocumentDrawer('${file.name}', 'Imported PDF File Content Preview.')">Preview</button></td>
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
        div.className = 'policy-clause-card glass-card p-16 mt-12';
        div.innerHTML = `
            <div class="clause-card-top flex-between">
                <span class="clause-id-title" style="font-size:15px; font-weight:800; color:#FFFFFF;">${c.clause_id} · ${c.clause_title}</span>
                <span class="badge-neutral">${category}</span>
            </div>
            <div class="clause-text-snippet mt-8" style="font-size:13px; color:#E9D5FF;">"${c.clause_text}"</div>
            <button class="btn-tertiary-link mt-8" onclick="openPolicyDrawer(${JSON.stringify(c).replace(/"/g, '&quot;')})">View clause details →</button>
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
            if (badge && badge.innerText.includes(formatRecText(filterType))) {
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
        state.investigatorName = newName;
        document.querySelectorAll('.user-name, .user-display-name').forEach(el => el.innerText = newName);
    }
    showToast('Profile Updated', '✓ Account profile saved successfully.', 'success');
}


/* ========================================== */
/* ASSISTANT & MODAL OVERLAYS                 */
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

    let answer = `Regarding "${val}": Claim ${state.activeClaim.claim_id} AI check result is ${formatRecText(state.activeClaim.recommendation)}.`;
    if (val.includes('flagged') || val.includes('mismatch')) {
        const cList = state.activeClaim.contradictions || [];
        answer = cList.length > 0 ? `Flagged due to ${cList.length} information mismatch(es): ${cList.map(c => c.description).join('; ')}` : "No information mismatches detected across your submitted documents.";
    } else if (val.includes('clause') || val.includes('policy')) {
        answer = `Evaluated against relevant policy terms: ${state.activeClaim.policy_assessments?.map(pa => `${pa.clause_id} (${pa.classification})`).join(', ')}`;
    } else if (val.includes('missing')) {
        answer = `Missing required documents: ${state.activeClaim.completeness?.missing_documents?.join(', ') || 'None (all required documents submitted)'}`;
    }

    showToast('ClaimProof Assistant', answer, 'info');
}

function openNewClaimModal() { document.getElementById('modal-new-claim').classList.remove('hidden'); }
function closeNewClaimModal() { document.getElementById('modal-new-claim').classList.add('hidden'); }
function showProcessingModal() { document.getElementById('modal-processing').classList.remove('hidden'); }
function hideProcessingModal() { document.getElementById('modal-processing').classList.add('hidden'); }

function openDocumentDrawer(filename, text) {
    document.getElementById('drawer-doc-filename').innerText = filename;
    document.getElementById('drawer-doc-content').innerText = text || "Imported document content preview.";
    document.getElementById('drawer-document').classList.remove('hidden');
}

function openEvidenceDrawer(item) {
    const body = document.getElementById('drawer-evidence-body');
    body.innerHTML = `
        <div class="def-item mt-8"><span class="def-label">Field Name</span><strong class="def-value">${item.field_name}</strong></div>
        <div class="def-item mt-8"><span class="def-label">Extracted Value</span><strong class="def-value" style="color:#E879F9;">${item.value}</strong></div>
        <div class="def-item mt-8"><span class="def-label">Source Document</span><strong class="def-value">${item.source_document}</strong></div>
        <div class="def-item mt-8"><span class="def-label">Certainty Score</span><strong class="def-value">${(item.confidence * 100).toFixed(0)}% certain</strong></div>
        <div class="doc-text-content mt-12">Raw Text Snippet:\n"${item.raw_text || item.value}"</div>
    `;
    document.getElementById('drawer-evidence').classList.remove('hidden');
}

function openPolicyDrawer(pa) {
    document.getElementById('drawer-policy-id').innerText = `${pa.clause_id} - ${pa.clause_title}`;
    const body = document.getElementById('drawer-policy-body');
    body.innerHTML = `
        <span class="badge-neutral">Page ${pa.page}</span>
        <span class="status-badge ${getBadgeClass(pa.classification)}">${pa.classification}</span>
        <div class="doc-text-content mt-12">"${pa.clause_text}"</div>
        <div class="mt-16"><strong>Why this clause applies:</strong><p style="font-size:13px; color:#E9D5FF; margin-top:4px;">${pa.reasoning}</p></div>
    `;
    document.getElementById('drawer-policy').classList.remove('hidden');
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
        { title: 'Case 1: Standard Accident (APPROVE)', action: () => runDemoClaimFromModal('claim_001_approve') },
        { title: 'Case 2: Missing Driving Licence (NEED INFO)', action: () => runDemoClaimFromModal('claim_002_request_information') },
        { title: 'Case 3: Date Contradiction (UNDER REVIEW)', action: () => runDemoClaimFromModal('claim_003_escalate') },
        { title: 'Case 4: Commercial Ride-share Use (REJECT)', action: () => runDemoClaimFromModal('claim_004_reject') },
        { title: 'View My Coverage', action: () => { toggleCommandPalette(); navigateTo('policies'); } },
        { title: 'Account Settings', action: () => { toggleCommandPalette(); navigateTo('settings'); } }
    ];

    items.filter(i => i.title.toLowerCase().includes(q)).forEach(item => {
        const div = document.createElement('div');
        div.className = 'cmd-item';
        div.style.padding = '10px 14px';
        div.style.cursor = 'pointer';
        div.innerHTML = `<span>${item.title}</span>`;
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
    if (!status) return 'APPROVED';
    const s = status.toUpperCase();
    if (s === 'REQUEST_INFORMATION' || s === 'REQ_INFO') return 'ACTION REQUIRED';
    if (s === 'ESCALATE') return 'UNDER REVIEW';
    return s.replace('_', ' ');
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
        <span style="font-weight:800;">${type === 'success' ? '✓' : type === 'warning' ? '⚠️' : 'ℹ️'} ${title}:</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
