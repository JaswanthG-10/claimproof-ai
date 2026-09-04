// ==========================================
// CLAIMPROOF AI - CUSTOMER SAAS CONTROLLER
// ==========================================

const state = {
    currentView: 'dashboard',
    sidebarCollapsed: false,
    activeClaim: null,
    claimsList: [],
    documentsList: [],
    auditLogs: [],
    allPolicies: [],
    userName: 'Jaswanth G.',
    userEmail: 'jaswanth@claimproof.ai',
    userPhone: '+91 98765 43210',
    userRole: 'Policy Holder',
    policyNumber: 'POL-2026-104',
    policyFilter: 'all',
    policySearchQuery: '',
    claimStep: 1,
    selectedType: 'accident',
    selectedUploadFile: null,
    isTransitioning: false
};

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    initCinematicLoginScene();
    initApp();
    setupEventListeners();
    setupLoginKeypressListener();
    checkHealth();
});

function initApp() {
    loadSavedSettings();
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
    // Sidebar Nav Item Clicks
    document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            navigateTo(view);
        });
    });

    // Keyboard Command Palette (Ctrl+K or Cmd+K)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            toggleCommandPalette();
        } else if (e.key === 'Escape') {
            closeAllOverlays();
        }
    });

    // Click outside profile menu
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

    // Policy Library Search
    document.getElementById('policy-library-search')?.addEventListener('input', (e) => {
        state.policySearchQuery = e.target.value.toLowerCase().trim();
        renderPolicyLibrary();
    });

    // Claims Filter Pills
    document.querySelectorAll('#claims-filter-pills .filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#claims-filter-pills .filter-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterClaimsTable(btn.getAttribute('data-filter') || 'all');
        });
    });

    // Claims Search Input
    document.getElementById('claims-search-input')?.addEventListener('input', (e) => {
        filterClaimsBySearch(e.target.value.toLowerCase().trim());
    });

    document.getElementById('cmd-search-trigger')?.addEventListener('click', toggleCommandPalette);
    document.getElementById('cmd-input')?.addEventListener('input', (e) => handleCmdSearch(e.target.value));

    // Assistant Composer Submit
    document.getElementById('ws-assistant-send-btn')?.addEventListener('click', handleAssistantSubmit);
    document.getElementById('ws-assistant-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAssistantSubmit();
    });

    // Upload modal dropzone and input setup
    setupUploadDropzoneListeners();
}


/* ========================================== */
/* THREE.JS CINEMATIC LOGIN SCENE             */
/* ========================================== */

let loginScene, loginCamera, loginRenderer, loginGraphGroup, loginAnimId;

function initCinematicLoginScene() {
    const canvas = document.getElementById('login-3d-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    loginScene = new THREE.Scene();
    loginScene.fog = new THREE.FogExp2(0x080E19, 0.03);

    loginCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    loginCamera.position.z = 26;

    loginRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    loginRenderer.setSize(width, height);
    loginRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    loginGraphGroup = new THREE.Group();
    loginScene.add(loginGraphGroup);

    // Connected Network Nodes: Documents -> Evidence -> Policy -> Recommendation
    const nodeStages = [
        { x: -10, color: 0x38BDF8, count: 5 }, // Documents (#38BDF8)
        { x: -3, color: 0x2563EB, count: 6 },  // Evidence (#2563EB)
        { x: 4, color: 0x38BDF8, count: 5 },   // Policy (#38BDF8)
        { x: 10, color: 0x2563EB, count: 4 }   // Recommendation (#2563EB)
    ];

    const nodePositions = [];
    const sphereGeo = new THREE.SphereGeometry(0.35, 16, 16);

    nodeStages.forEach(stage => {
        const stageNodes = [];
        for (let i = 0; i < stage.count; i++) {
            const y = (i - (stage.count - 1) / 2) * 2.8 + (Math.random() - 0.5) * 0.5;
            const z = (Math.random() - 0.5) * 3;

            const mat = new THREE.MeshBasicMaterial({
                color: stage.color,
                transparent: true,
                opacity: 0.75
            });
            const mesh = new THREE.Mesh(sphereGeo, mat);
            mesh.position.set(stage.x, y, z);
            loginGraphGroup.add(mesh);

            // Subtle outer halo
            const haloGeo = new THREE.SphereGeometry(0.65, 12, 12);
            const haloMat = new THREE.MeshBasicMaterial({
                color: stage.color,
                transparent: true,
                opacity: 0.15,
                wireframe: true
            });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.position.set(stage.x, y, z);
            loginGraphGroup.add(halo);

            stageNodes.push({ x: stage.x, y, z });
        }
        nodePositions.push(stageNodes);
    });

    // Connecting lines between stages
    const lineMat = new THREE.LineBasicMaterial({
        color: 0x2563EB,
        transparent: true,
        opacity: 0.22
    });

    for (let s = 0; s < nodePositions.length - 1; s++) {
        const curr = nodePositions[s];
        const next = nodePositions[s + 1];

        curr.forEach(n1 => {
            next.forEach(n2 => {
                if (Math.random() > 0.42) return;
                const points = [
                    new THREE.Vector3(n1.x, n1.y, n1.z),
                    new THREE.Vector3((n1.x + n2.x) / 2, (n1.y + n2.y) / 2 + (Math.random() - 0.5) * 1.5, (n1.z + n2.z) / 2 + (Math.random() - 0.5) * 1.5),
                    new THREE.Vector3(n2.x, n2.y, n2.z)
                ];
                const curve = new THREE.CatmullRomCurve3(points);
                const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(18));
                const line = new THREE.Line(geometry, lineMat);
                loginGraphGroup.add(line);
            });
        });
    }

    // Ambient floating particles
    const particleCount = 100;
    const particleGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 32;
        posArray[i + 1] = (Math.random() - 0.5) * 20;
        posArray[i + 2] = (Math.random() - 0.5) * 14;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
        size: 0.08,
        color: 0x38BDF8,
        transparent: true,
        opacity: 0.4
    });
    loginGraphGroup.add(new THREE.Points(particleGeo, particleMat));

    // Handle Resize
    window.addEventListener('resize', onLoginWindowResize);

    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        loginRenderer.render(loginScene, loginCamera);
        return;
    }

    let clock = new THREE.Clock();
    function animate() {
        loginAnimId = requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // Slow, ambient rotation & drifting
        loginGraphGroup.rotation.y = elapsedTime * 0.035;
        loginGraphGroup.rotation.x = Math.sin(elapsedTime * 0.2) * 0.03;

        particleMat.opacity = 0.3 + Math.sin(elapsedTime * 1.2) * 0.15;
        loginRenderer.render(loginScene, loginCamera);
    }
    animate();
}

function onLoginWindowResize() {
    if (!loginCamera || !loginRenderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    loginCamera.aspect = w / h;
    loginCamera.updateProjectionMatrix();
    loginRenderer.setSize(w, h);
}

function handleLoginKeyPress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleWorkspaceEntry();
    }
}

function setupLoginKeypressListener() {
    window.addEventListener('keydown', handleLoginKeyPress);
}

function removeLoginKeypressListener() {
    window.removeEventListener('keydown', handleLoginKeyPress);
}

function handleWorkspaceEntry() {
    if (state.isTransitioning) return;
    state.isTransitioning = true;

    removeLoginKeypressListener();

    const welcome = document.getElementById('welcome-screen');
    const shell = document.getElementById('app-shell');
    const enterBtn = document.getElementById('enter-workspace-btn');

    if (enterBtn) enterBtn.disabled = true;

    // Short exit transition: scene zooms in slightly + fades to --background (420ms)
    welcome?.classList.add('fade-zoom-exit');

    setTimeout(() => {
        welcome?.classList.add('hidden');
        shell?.classList.remove('hidden');
        state.isTransitioning = false;
        navigateTo('dashboard');
        showToast('Welcome back, Jaswanth', 'Workspace ready for claim readiness review.', 'success');
    }, 420);
}

function showWelcomeScreen() {
    const welcome = document.getElementById('welcome-screen');
    const shell = document.getElementById('app-shell');
    const enterBtn = document.getElementById('enter-workspace-btn');

    document.getElementById('profile-popup-menu')?.classList.add('hidden');

    if (enterBtn) enterBtn.disabled = false;
    welcome?.classList.remove('hidden', 'fade-zoom-exit');
    shell?.classList.add('hidden');

    setupLoginKeypressListener();
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

    document.querySelectorAll('.content-view').forEach(el => el.classList.add('hidden'));
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.remove('hidden');

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
        if (el.getAttribute('data-view') === viewName) el.classList.add('active');
        else el.classList.remove('active');
    });

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

    if (viewName === 'my-claims') renderClaimsTable();
    else if (viewName === 'documents') renderDocumentsTable();
    else if (viewName === 'missing-documents') renderMissingDocumentsView();
    else if (viewName === 'policies' || viewName === 'policy-details') renderPolicyLibrary();
    else if (viewName === 'dashboard') updateDashboardPriorityCard();
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
/* DEMO CASES RUNNER & DEFAULT CLAIM SETUP   */
/* ========================================== */

async function fetchDemoCasesList() {
    try {
        const res = await fetch('/api/demo-cases');
        if (res.ok) {
            await res.json();
            await loadInitialDefaultClaims();
        } else {
            loadOfflineDefaultClaims();
        }
    } catch (e) {
        console.warn('Demo cases prefetch fallback:', e);
        loadOfflineDefaultClaims();
    }
}

async function loadInitialDefaultClaims() {
    try {
        // Fetch claim_002 (Missing DL) to represent user's primary active claim CLM-CUSTOM-001
        const res2 = await fetch('/api/demo-cases/claim_002_request_information/analyze', { method: 'POST' });
        if (res2.ok) {
            const data2 = await res2.json();
            const customClaim = JSON.parse(JSON.stringify(data2));
            customClaim.claim_id = 'CLM-CUSTOM-001';
            customClaim.customer_name = state.userName || 'Jaswanth G.';
            customClaim.vehicle_number = 'TN00DM2026';
            customClaim.claimed_amount = 48750;

            state.activeClaim = customClaim;
            state.claimsList = [customClaim];
        }

        // Also fetch claim_001 (Approved) so user has multi-claim history
        const res1 = await fetch('/api/demo-cases/claim_001_approve/analyze', { method: 'POST' });
        if (res1.ok) {
            const data1 = await res1.json();
            const prevClaim = JSON.parse(JSON.stringify(data1));
            prevClaim.claim_id = 'CLM-2026-089';
            prevClaim.customer_name = state.userName || 'Jaswanth G.';
            prevClaim.vehicle_number = 'TN00DM2026';
            prevClaim.claimed_amount = 32500;
            state.claimsList.push(prevClaim);
        }

        updateDashboardPriorityCard();
        renderWorkspace(state.activeClaim);
        renderDashboardRecentTable();
        renderClaimsTable();
        renderDocumentsTable();
        renderMissingDocumentsView();
        renderPolicyLibrary();
    } catch (e) {
        console.warn('Default claims load error, using offline fallback:', e);
        loadOfflineDefaultClaims();
    }
}

function loadOfflineDefaultClaims() {
    const defaultClaim = {
        claim_id: 'CLM-CUSTOM-001',
        customer_name: state.userName || 'Jaswanth G.',
        vehicle_number: 'TN00DM2026',
        incident_type: 'accident',
        incident_date: '2026-08-21',
        claimed_amount: 48750,
        recommendation: 'REQUEST_INFORMATION',
        completeness: {
            required_documents: ['claim_form', 'repair_estimate', 'registration_certificate', 'driving_licence'],
            missing_documents: ['driving_licence']
        },
        evidence_items: [
            { source_document: 'Claim_Form_Jaswanth_G.pdf', field_name: 'claim_form', value: 'Complete', confidence: 0.98 },
            { source_document: 'Repair_Estimate_Invoice.pdf', field_name: 'repair_estimate', value: '₹48,750', confidence: 0.95 },
            { source_document: 'Registration_Certificate_RC.pdf', field_name: 'rc_book', value: 'TN00DM2026', confidence: 0.99 }
        ],
        contradictions: [],
        findings: []
    };

    const prevClaim = {
        claim_id: 'CLM-2026-089',
        customer_name: state.userName || 'Jaswanth G.',
        vehicle_number: 'TN00DM2026',
        incident_type: 'theft',
        incident_date: '2026-05-14',
        claimed_amount: 32500,
        recommendation: 'APPROVE',
        completeness: {
            required_documents: ['claim_form', 'police_fir', 'registration_certificate'],
            missing_documents: []
        },
        evidence_items: [],
        contradictions: [],
        findings: []
    };

    state.activeClaim = defaultClaim;
    state.claimsList = [defaultClaim, prevClaim];

    updateDashboardPriorityCard();
    renderWorkspace(defaultClaim);
    renderDashboardRecentTable();
    renderClaimsTable();
    renderDocumentsTable();
    renderMissingDocumentsView();
    renderPolicyLibrary();
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
        updateDashboardPriorityCard();

        if (navigate) {
            setTimeout(() => {
                hideProcessingModal();
                renderWorkspace(data);
                renderDashboardRecentTable();
                renderClaimsTable();
                renderDocumentsTable();
                renderMissingDocumentsView();
                navigateTo('workspace');
                showToast('AI Claim Check Complete', `Readiness: ${formatRecText(data.recommendation)}`, 'success');
            }, 600);
        } else {
            renderWorkspace(data);
            renderDashboardRecentTable();
            renderClaimsTable();
            renderDocumentsTable();
            renderMissingDocumentsView();
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
    statusBadge.innerHTML = `<span class="badge-icon-symbol">${getStatusSymbol(claim.recommendation)}</span> ${formatRecText(claim.recommendation)}`;
    statusBadge.className = `badge-status ${getBadgeClass(claim.recommendation)}`;

    // Left Panel: Documents & Evidence (Available vs Missing)
    const reqDocs = claim.completeness?.required_documents || ['claim_form', 'repair_estimate', 'registration_certificate', 'driving_licence'];
    const missingDocs = claim.completeness?.missing_documents || [];
    const availableDocs = reqDocs.filter(d => !missingDocs.includes(d));

    const missingList = document.getElementById('ws-doc-missing-list');
    const availList = document.getElementById('ws-doc-available-list');
    if (missingList) missingList.innerHTML = '';
    if (availList) availList.innerHTML = '';

    const availableCount = availableDocs.length;
    const totalCount = reqDocs.length;
    const counterEl = document.getElementById('ws-doc-counter');
    if (counterEl) counterEl.innerText = `${availableCount} of ${totalCount} available`;

    // Render Available Documents
    if (availList) {
        const policyRow = document.createElement('div');
        policyRow.className = 'doc-status-row positive';
        policyRow.style.padding = '8px 12px';
        policyRow.style.background = 'var(--surface-2)';
        policyRow.style.borderRadius = '6px';
        policyRow.style.marginTop = '6px';
        policyRow.style.fontSize = '13px';
        policyRow.style.fontWeight = '500';
        policyRow.style.cursor = 'pointer';
        policyRow.innerHTML = `<span style="color:var(--success);">✓ Policy Document (Active POL-2026-104)</span>`;
        policyRow.onclick = () => navigateTo('policies');
        availList.appendChild(policyRow);

        availableDocs.forEach(doc => {
            const div = document.createElement('div');
            div.className = 'doc-status-row positive';
            div.style.padding = '8px 12px';
            div.style.background = 'var(--surface-2)';
            div.style.borderRadius = '6px';
            div.style.marginTop = '6px';
            div.style.fontSize = '13px';
            div.style.fontWeight = '500';
            div.style.cursor = 'pointer';
            div.innerHTML = `<span style="color:var(--success);">✓ ${doc.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>`;
            div.onclick = () => openDocumentDrawer(`${doc}.pdf`, claim.evidence_items?.find(e => e.source_document && e.source_document.includes(doc))?.raw_text || "Document text content verified.");
            availList.appendChild(div);
        });
    }

    // Render Missing Documents
    if (missingList) {
        if (missingDocs.length > 0) {
            missingDocs.forEach(doc => {
                const div = document.createElement('div');
                div.className = 'doc-status-row warning';
                div.style.padding = '8px 12px';
                div.style.background = 'rgba(245, 158, 11, 0.12)';
                div.style.border = '1px solid rgba(245, 158, 11, 0.3)';
                div.style.borderRadius = '6px';
                div.style.marginTop = '6px';
                div.style.fontSize = '13px';
                div.style.fontWeight = '600';
                div.style.cursor = 'pointer';
                div.title = 'Click to upload this document';
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--warning);">! ${doc.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                        <span style="font-size:11px; text-decoration:underline; color:var(--primary);">Upload +</span>
                    </div>
                `;
                div.onclick = () => openUploadDocumentModal(doc);
                missingList.appendChild(div);
            });
        } else {
            missingList.innerHTML = `<div class="metadata-text" style="color:var(--success); padding:6px 0; font-weight:600;">✓ All required documents available.</div>`;
        }
    }

    // Center Panel: Claim Summary Facts Grid
    const factName = document.getElementById('ws-fact-name');
    const factVehicle = document.getElementById('ws-fact-vehicle');
    const factType = document.getElementById('ws-fact-type');
    const factDate = document.getElementById('ws-fact-date');
    const factAmount = document.getElementById('ws-fact-amount');

    if (factName) factName.innerText = claim.customer_name || state.userName || 'Jaswanth G.';
    if (factVehicle) factVehicle.innerText = claim.vehicle_number || 'TN00DM2026';
    if (factType) factType.innerText = claim.incident_type ? claim.incident_type.charAt(0).toUpperCase() + claim.incident_type.slice(1) : 'Accident';
    if (factDate) factDate.innerText = claim.incident_date || '2026-08-21';
    if (factAmount) factAmount.innerText = claim.claimed_amount ? `₹${Number(claim.claimed_amount).toLocaleString('en-IN')}` : '₹48,750';

    // Contradictions / Mismatches Cards
    const cCard = document.getElementById('ws-contradiction-card');
    const cContainer = document.getElementById('ws-contradictions-container');
    const contradictions = claim.contradictions || [];

    if (cCard && cContainer) {
        if (contradictions.length > 0) {
            cCard.classList.remove('hidden');
            document.getElementById('ws-issues-count-badge').innerHTML = `<span class="badge-icon-symbol">!</span> ${contradictions.length} Issue${contradictions.length > 1 ? 's' : ''}`;
            cContainer.innerHTML = '';

            contradictions.forEach(c => {
                const card = document.createElement('div');
                card.className = 'issue-card';
                card.innerHTML = `
                    <div class="issue-card-top">
                        <span class="issue-title">! ${c.field_name.replace('_', ' ').toUpperCase()} MISMATCH</span>
                        <span class="badge-status request"><span class="badge-icon-symbol">!</span> POTENTIAL ISSUE</span>
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
    }

    // Right Panel: Customer-Friendly AI Claim Assessment
    const recCard = document.getElementById('ws-rec-card');
    const recType = (claim.recommendation || 'APPROVE').toUpperCase();
    if (recCard) {
        recCard.className = `card-enterprise recommendation-panel ${recType.toLowerCase()}`;
    }
    
    const recTitleEl = document.getElementById('ws-rec-title');
    const recSummaryEl = document.getElementById('ws-rec-summary');
    const recExplanationEl = document.getElementById('ws-rec-explanation');
    const recGuidanceEl = document.getElementById('ws-rec-guidance');

    if (recTitleEl) recTitleEl.innerText = formatRecText(recType);

    if (recType === 'APPROVE') {
        if (recSummaryEl) recSummaryEl.innerText = "Your claim currently appears ready for submission with complete required documentation and valid policy coverage.";
        if (recExplanationEl) recExplanationEl.innerHTML = "✓ All mandatory documents available<br>✓ Valid coverage dates verified<br>✓ Repair estimate within policy limits";
        if (recGuidanceEl) recGuidanceEl.innerText = "You can proceed to submit your claim package to your insurer.";
    } else if (recType === 'REQUEST_INFORMATION' || recType === 'REQ_INFO') {
        if (recSummaryEl) recSummaryEl.innerText = "Your claim currently appears to meet some policy requirements, but additional information is needed before it is ready.";
        if (recExplanationEl) recExplanationEl.innerHTML = "• Driving Licence missing<br>• Incident Date verification on Claim Form";
        if (recGuidanceEl) recGuidanceEl.innerText = "Upload your driving licence to make your claim ready for submission.";
    } else if (recType === 'ESCALATE') {
        if (recSummaryEl) recSummaryEl.innerText = "A date contradiction was detected across your submitted evidence that requires clarification.";
        if (recExplanationEl) recExplanationEl.innerHTML = "• Incident Date mismatch between Claim Form and Police FIR";
        if (recGuidanceEl) recGuidanceEl.innerText = "Update your incident date or submit an updated statement to clarify the mismatch.";
    } else if (recType === 'REJECT') {
        if (recSummaryEl) recSummaryEl.innerText = "A potential policy exclusion clause was identified during the automated coverage check.";
        if (recExplanationEl) recExplanationEl.innerHTML = "• Vehicle operated for commercial ride-share taxi use (Exclusion Clause 4.2)";
        if (recGuidanceEl) recGuidanceEl.innerText = "Review exclusion Clause 4.2 or contact your insurer for clarification.";
    }
}

function updateDashboardPriorityCard() {
    const claim = state.activeClaim || (state.claimsList.length > 0 ? state.claimsList[0] : null);
    if (!claim) return;

    const titleEl = document.getElementById('home-claim-title');
    const subEl = document.getElementById('home-claim-sub');
    const badgeEl = document.getElementById('home-claim-badge');
    const badgeTextEl = document.getElementById('home-claim-badge-text');
    const badgeIconEl = document.getElementById('home-claim-badge-icon');
    const valEl = document.getElementById('home-readiness-val');
    const barEl = document.getElementById('home-readiness-bar');
    const missingEl = document.getElementById('home-missing-flag');
    const continueBtn = document.getElementById('home-continue-claim-btn');

    if (titleEl) titleEl.innerText = `Current Claim: ${claim.claim_id}`;
    if (subEl) subEl.innerText = `${claim.incident_type ? claim.incident_type.charAt(0).toUpperCase() + claim.incident_type.slice(1) : 'Motor Accident'} Claim · Vehicle ${claim.vehicle_number || 'TN00DM2026'}`;
    if (continueBtn) continueBtn.setAttribute('onclick', `openClaimWorkspace('${claim.claim_id}')`);

    const missingDocs = claim.completeness?.missing_documents || [];
    const reqDocs = claim.completeness?.required_documents || ['claim_form', 'repair_estimate', 'registration_certificate', 'driving_licence'];
    const availableCount = Math.max(0, reqDocs.length - missingDocs.length);
    const pct = Math.round((availableCount / reqDocs.length) * 100);

    if (valEl) valEl.innerText = `${availableCount} of ${reqDocs.length} required documents available`;
    if (barEl) {
        barEl.style.width = `${pct}%`;
        if (pct >= 100) {
            barEl.className = 'progress-bar-fill';
            barEl.style.backgroundColor = 'var(--success)';
        } else {
            barEl.className = 'progress-bar-fill warning-fill';
            barEl.style.backgroundColor = 'var(--warning)';
        }
    }

    if (missingDocs.length > 0) {
        const formattedMissing = missingDocs.map(d => d.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())).join(', ');
        if (missingEl) {
            missingEl.innerText = `! Missing: ${formattedMissing}`;
            missingEl.style.color = 'var(--warning)';
        }
        if (badgeEl) badgeEl.className = 'badge-status request mb-12';
        if (badgeIconEl) badgeIconEl.innerText = '!';
        if (badgeTextEl) badgeTextEl.innerText = 'MORE INFORMATION NEEDED';
    } else {
        if (missingEl) {
            missingEl.innerText = '✓ All required documents available';
            missingEl.style.color = 'var(--success)';
        }
        if (badgeEl) badgeEl.className = 'badge-status approve mb-12';
        if (badgeIconEl) badgeIconEl.innerText = '✓';
        if (badgeTextEl) badgeTextEl.innerText = 'READY FOR SUBMISSION';
    }

    // Update sidebar missing badge count
    const missingBadge = document.getElementById('sidebar-missing-count');
    if (missingBadge) {
        missingBadge.innerText = missingDocs.length;
        if (missingDocs.length === 0) {
            missingBadge.style.background = 'rgba(74, 222, 128, 0.18)';
            missingBadge.style.color = 'var(--success)';
            missingBadge.style.borderColor = 'rgba(74, 222, 128, 0.3)';
        } else {
            missingBadge.style.background = 'rgba(245, 158, 11, 0.18)';
            missingBadge.style.color = 'var(--warning)';
            missingBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
        }
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
            <td>${c.incident_date || '2026-08-21'}</td>
            <td>₹${Number(c.claimed_amount || 48750).toLocaleString('en-IN')}</td>
            <td><span class="status-badge ${getBadgeClass(c.recommendation)}"><span class="badge-icon-symbol">${getStatusSymbol(c.recommendation)}</span> ${formatRecText(c.recommendation)}</span></td>
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
        const missingCount = c.completeness?.missing_documents?.length || 0;
        const totalDocs = c.completeness?.required_documents?.length || 4;
        const readyText = missingCount > 0 ? `${totalDocs - missingCount}/${totalDocs} Docs` : `${totalDocs}/${totalDocs} Docs Ready`;

        tr.innerHTML = `
            <td><strong>${c.claim_id}</strong></td>
            <td>${c.incident_type ? c.incident_type.toUpperCase() : 'ACCIDENT'}</td>
            <td>${c.vehicle_number}</td>
            <td>${c.incident_date || '2026-08-21'}</td>
            <td>₹${Number(c.claimed_amount || 48750).toLocaleString('en-IN')}</td>
            <td><span class="status-badge ${getBadgeClass(c.recommendation)}"><span class="badge-icon-symbol">${getStatusSymbol(c.recommendation)}</span> ${formatRecText(c.recommendation)}</span></td>
            <td>${readyText}</td>
            <td><button class="btn-tertiary-link" onclick="openClaimWorkspace('${c.claim_id}')">Continue</button></td>
        `;
        tbody.appendChild(tr);
    });

    const sidebarCount = document.getElementById('sidebar-claims-count');
    if (sidebarCount) sidebarCount.innerText = state.claimsList.length;
}

function openClaimWorkspace(claimId) {
    let found = state.claimsList.find(c => c.claim_id === claimId);
    if (!found) {
        if (state.activeClaim && (state.activeClaim.claim_id === claimId || !claimId)) {
            found = state.activeClaim;
        } else if (state.claimsList.length > 0) {
            found = state.claimsList[0];
        }
    }

    if (found) {
        state.activeClaim = found;
        renderWorkspace(found);
        updateDashboardPriorityCard();
        navigateTo('workspace');
    } else {
        showToast('Loading Claim', 'Initializing workspace for your active claim...', 'info');
        runDemoClaim('claim_002_request_information', true);
    }
}

function renderDocumentsTable() {
    const tbody = document.getElementById('documents-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Standard baseline documents + any uploaded evidence
    const defaultDocs = [
        { name: 'Claim_Form_Jaswanth_G.pdf', type: 'Claim Form', claimId: 'CLM-CUSTOM-001', date: '2026-09-04', status: 'Verified' },
        { name: 'Repair_Estimate_Invoice.pdf', type: 'Repair Estimate', claimId: 'CLM-CUSTOM-001', date: '2026-09-04', status: 'Verified' },
        { name: 'Registration_Certificate_RC.pdf', type: 'RC Document', claimId: 'CLM-CUSTOM-001', date: '2026-09-04', status: 'Verified' }
    ];

    const allDocs = [...defaultDocs, ...(state.documentsList || [])];

    allDocs.forEach(doc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${doc.name}</strong></td>
            <td><span class="badge-neutral">${doc.type}</span></td>
            <td>${doc.claimId}</td>
            <td>${doc.date}</td>
            <td><span class="status-badge approve"><span class="badge-icon-symbol">✓</span> ${doc.status}</span></td>
            <td>
                <button class="btn-tertiary-link" onclick="openDocumentDrawer('${doc.name}', 'Document preview content for ${doc.name}. Verified against active policy POL-2026-104.')">View</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderMissingDocumentsView() {
    const container = document.getElementById('missing-docs-list-container');
    if (!container) return;
    container.innerHTML = '';

    const claim = state.activeClaim || (state.claimsList.length > 0 ? state.claimsList[0] : null);
    const missingDocs = claim?.completeness?.missing_documents || [];

    if (missingDocs.length > 0) {
        missingDocs.forEach(doc => {
            const docTitle = doc.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
            const card = document.createElement('div');
            card.className = 'card-enterprise sub-card mb-16';
            card.innerHTML = `
                <div class="card-header-flex">
                    <div>
                        <h4 class="card-title">${docTitle}</h4>
                        <span class="card-subtitle">Required for: <strong>${claim.claim_id}</strong> (${claim.incident_type || 'Accident'} Claim)</span>
                    </div>
                    <span class="status-badge request"><span class="badge-icon-symbol">!</span> Required</span>
                </div>
                <div class="mt-12">
                    <span class="field-label">REASON</span>
                    <p class="body-text mt-4">Required under motor policy rules to verify driver qualification and accident circumstances before settlement.</p>
                </div>
                <div class="mt-12">
                    <span class="field-label">POLICY REFERENCE</span>
                    <p class="body-text mt-4">Clause 3.4 & Clause 5.1 — Driver Qualification & Licence Requirements</p>
                </div>
                <div class="mt-16">
                    <button class="btn-primary" onclick="openUploadDocumentModal('${doc}')">Upload ${docTitle}</button>
                </div>
            `;
            container.appendChild(card);
        });
    } else {
        const card = document.createElement('div');
        card.className = 'card-enterprise sub-card mb-16';
        card.style.textAlign = 'center';
        card.style.padding = '36px 24px';
        card.innerHTML = `
            <div class="result-icon-circle success mb-16">✓</div>
            <h3 class="card-title-elevated">All Required Documents Uploaded!</h3>
            <p class="body-text mt-8" style="max-width:480px; margin-left:auto; margin-right:auto;">
                All mandatory documents for claim <strong>${claim ? claim.claim_id : 'CLM-CUSTOM-001'}</strong> have been uploaded and verified. Your claim is ready for submission.
            </p>
            <div class="mt-20">
                <button class="btn-primary" onclick="navigateTo('workspace')">View Claim Workspace →</button>
            </div>
        `;
        container.appendChild(card);
    }
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

function filterClaimsBySearch(query) {
    const rows = document.querySelectorAll('#claims-table-body tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if (!query || text.includes(query)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}


/* ========================================== */
/* MASTER POLICY CLAUSES & CATEGORIZED VIEW   */
/* ========================================== */

const MASTER_POLICY_CLAUSES = [
    // 1. COVERAGE
    {
        clause_id: 'Clause 2.1',
        clause_title: 'Own Damage & Accidental Collision',
        category: 'COVERAGE',
        icon: '🛡️',
        clause_text: 'The Company will indemnify the Insured against loss or damage to the vehicle insured and/or accessories by accidental external means, collision, or overturning.',
        reasoning: 'Covers physical repairs and parts replacement up to the Insured Declared Value (IDV) subject to depreciation and deductible.',
        page: 4,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 2.2',
        clause_title: 'Third Party Legal Liability',
        category: 'COVERAGE',
        icon: '⚖️',
        clause_text: 'Subject to limits of liability, the Company will indemnify the Insured in the event of an accident against all sums the Insured becomes legally liable to pay in respect of third-party property damage or bodily injury.',
        reasoning: 'Standard statutory liability coverage mandated under the Motor Vehicles Act.',
        page: 5,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 2.3',
        clause_title: 'Fire, Lightning & Explosion',
        category: 'COVERAGE',
        icon: '🔥',
        clause_text: 'Loss or damage resulting from fire, explosion, self-ignition or lightning is covered provided the vehicle was maintained in roadworthy condition without unauthorized electrical modifications.',
        reasoning: 'Full settlement eligibility for thermal and fire incidents when corroborated by surveyor inspection.',
        page: 4,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 2.4',
        clause_title: 'Theft & Total Loss',
        category: 'COVERAGE',
        icon: '🔒',
        clause_text: 'In the event of total vehicle theft or burglary, the Company will settle the claim based on the Insured Declared Value (IDV) following non-traceable police final report.',
        reasoning: 'Applies to total loss when original keys, registration documents, and police non-traceable reports are provided.',
        page: 6,
        classification: 'SUPPORTED'
    },

    // 2. EXCLUSIONS
    {
        clause_id: 'Clause 4.1',
        clause_title: 'Driving Under Influence of Alcohol or Drugs',
        category: 'EXCLUSIONS',
        icon: '⚠️',
        clause_text: 'The Company shall not be liable to make any payment in respect of any accidental loss or damage suffered whilst the insured vehicle is being driven by any person whilst under the influence of intoxicating liquor or drugs.',
        reasoning: 'Immediate exclusion of coverage if medical test or police report confirms intoxication above statutory limits.',
        page: 8,
        classification: 'BLOCKED'
    },
    {
        clause_id: 'Clause 4.2',
        clause_title: 'Commercial Ride-Sharing or Taxi Use',
        category: 'EXCLUSIONS',
        icon: '🚫',
        clause_text: 'The policy excludes any loss, damage and/or liability sustained or incurred whilst the private vehicle is being used otherwise than in accordance with the Limitations as to Use, including hire, fare reward, or unauthorized commercial taxi operation.',
        reasoning: 'Private motor insurance strictly excludes commercial fare-paying transport without commercial endorsement.',
        page: 9,
        classification: 'BLOCKED'
    },
    {
        clause_id: 'Clause 4.3',
        clause_title: 'Consequential & Mechanical Breakdown',
        category: 'EXCLUSIONS',
        icon: '⚙️',
        clause_text: 'The Company shall not be liable in respect of consequential loss, depreciation, wear and tear, mechanical or electrical breakdown, failures or breakages.',
        reasoning: 'Internal mechanical component failures unrelated to external collision impact are excluded from settlement.',
        page: 8,
        classification: 'BLOCKED'
    },
    {
        clause_id: 'Clause 4.4',
        clause_title: 'Intentional Damage or Staged Accidents',
        category: 'EXCLUSIONS',
        icon: '🛑',
        clause_text: 'Any deliberate, pre-meditated, or fraudulent acts resulting in vehicle damage shall render the policy void and result in forfeiture of all claims.',
        reasoning: 'Zero-tolerance policy clause protecting evidence integrity and preventing insurance fraud.',
        page: 10,
        classification: 'BLOCKED'
    },

    // 3. REQUIRED DOCUMENTS
    {
        clause_id: 'Clause 3.1',
        clause_title: 'Signed Claim Form & Incident Statement',
        category: 'REQUIRED',
        icon: '📝',
        clause_text: 'Notice shall be given in writing to the Company immediately upon the occurrence of any accidental loss or damage. A duly completed and signed Claim Form must be submitted within 7 days of incident.',
        reasoning: 'Mandatory initial submission detailing vehicle, driver, date, and narrative of the incident.',
        page: 7,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 3.2',
        clause_title: 'Itemized Repair Estimate & Workshop Invoice',
        category: 'REQUIRED',
        icon: '🧾',
        clause_text: 'An itemized detailed repair estimate from an authorized garage showing labor charges and replacement parts must be presented before repair commences.',
        reasoning: 'Enables insurance surveyor assessment against market depreciation tables prior to approval.',
        page: 7,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 3.3',
        clause_title: 'Registration Certificate (RC Book)',
        category: 'REQUIRED',
        icon: '📄',
        clause_text: 'A copy of the valid Vehicle Registration Certificate issued by the Regional Transport Authority must be provided with engine and chassis numbers matching policy schedule.',
        reasoning: 'Verifies insurable interest and ownership of the claimed motor vehicle.',
        page: 7,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 3.4',
        clause_title: 'Valid Driving Licence of Person Driving',
        category: 'REQUIRED',
        icon: '🪪',
        clause_text: 'Any person driving the vehicle at the time of accident must hold an effective and valid driving licence for the category of vehicle and not be disqualified from holding such licence.',
        reasoning: 'Essential statutory condition. Failure to produce a valid driving licence renders own-damage claim unpayable.',
        page: 7,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 3.5',
        clause_title: 'Police First Information Report (FIR)',
        category: 'REQUIRED',
        icon: '🚔',
        clause_text: 'In cases of third-party property damage, bodily injury, major highway collision, or theft, a certified copy of the Police First Information Report (FIR) is mandatory.',
        reasoning: 'Provides independent official corroboration of incident location, date, and third-party details.',
        page: 8,
        classification: 'SUPPORTED'
    },

    // 4. IDV & CLAIM CONDITIONS
    {
        clause_id: 'Clause 1.1',
        clause_title: 'Insured Declared Value (IDV) Limit ₹5,00,000',
        category: 'IDV',
        icon: '💰',
        clause_text: 'The Insured Declared Value (IDV) of the vehicle shall be treated as the Maximum Sum Insured for the purpose of this policy throughout the period of insurance.',
        reasoning: 'Sets the maximum liability of the insurer in the event of total loss or constructive total loss.',
        page: 3,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 1.2',
        clause_title: 'Depreciation on Parts Replaced',
        category: 'IDV',
        icon: '📉',
        clause_text: 'Depreciation rates shall apply to replacement parts: Rubber/Nylon/Plastic (50%), Fiber glass (30%), Glass parts (Nil), Metal parts according to vehicle age scale.',
        reasoning: 'Governs payout calculations for individual damaged components during claim settlement.',
        page: 4,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 1.3',
        clause_title: 'Active Policy Period & Validity',
        category: 'IDV',
        icon: '📅',
        clause_text: 'Coverage applies only to incidents occurring between 00:00 hrs of Policy Inception Date (01 Jan 2026) and Midnight of Policy Expiry Date (31 Dec 2026).',
        reasoning: 'Incidents occurring outside active dates or during lapsed grace periods are not covered.',
        page: 2,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 1.4',
        clause_title: 'Compulsory Excess / Deductible ₹1,000',
        category: 'IDV',
        icon: '🏷️',
        clause_text: 'The Insured shall be responsible for the first ₹1,000 of each and every claim arising out of accidental damage to the vehicle.',
        reasoning: 'Standard regulatory deductible subtracted from final admissible settlement amount.',
        page: 3,
        classification: 'SUPPORTED'
    }
];

function renderPolicyLibrary() {
    const grid = document.getElementById('policy-library-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const filter = (state.policyFilter || 'all').toLowerCase();
    const query = (state.policySearchQuery || '').toLowerCase();

    const filtered = MASTER_POLICY_CLAUSES.filter(c => {
        const cat = c.category.toLowerCase();
        
        // Category Filter Match
        let catMatch = false;
        if (filter === 'all') catMatch = true;
        else if (filter === 'coverage' && cat === 'coverage') catMatch = true;
        else if (filter === 'required' && cat === 'required') catMatch = true;
        else if (filter === 'exclusions' && cat === 'exclusions') catMatch = true;
        else if (filter === 'idv' && cat === 'idv') catMatch = true;

        if (!catMatch) return false;

        // Search Query Match
        if (query) {
            const searchable = `${c.clause_id} ${c.clause_title} ${c.clause_text} ${c.reasoning} ${c.category}`.toLowerCase();
            return searchable.includes(query);
        }

        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="card-enterprise sub-card" style="text-align:center; padding:32px;">
                <p class="body-text">No policy clauses matched your search query "<strong>${state.policySearchQuery}</strong>".</p>
                <button class="btn-secondary mt-12" onclick="document.getElementById('policy-library-search').value = ''; state.policySearchQuery = ''; renderPolicyLibrary();">Clear Search</button>
            </div>
        `;
        return;
    }

    filtered.forEach(c => {
        const catClass = `cat-${c.category.toLowerCase()}`;
        const div = document.createElement('div');
        div.className = `policy-card-cat ${catClass}`;
        
        div.innerHTML = `
            <div class="policy-card-header">
                <div class="policy-title-group">
                    <span class="policy-cat-icon">${c.icon}</span>
                    <div>
                        <span class="policy-clause-num">${c.clause_id} · ${c.clause_title}</span>
                    </div>
                </div>
                <span class="policy-cat-badge ${catClass}">${c.category.replace('_', ' ')}</span>
            </div>
            <p class="policy-clause-desc">"${c.clause_text}"</p>
            <div class="policy-impact-box">
                <strong>How this affects your claim:</strong>
                <span>${c.reasoning}</span>
            </div>
            <div class="mt-12" style="display:flex; justify-content:flex-end;">
                <button class="btn-tertiary-link" onclick="openPolicyDrawer(${JSON.stringify(c).replace(/"/g, '&quot;')})">View Original Clause Details →</button>
            </div>
        `;
        grid.appendChild(div);
    });
}


/* ========================================== */
/* SETTINGS: PROFILE & NOTIFICATION PREFS     */
/* ========================================== */

function switchSettingsTab(tabName, element) {
    document.querySelectorAll('.settings-tabs .tab-item').forEach(b => b.classList.remove('active'));
    element?.classList.add('active');

    document.getElementById('settings-panel-profile')?.classList.add('hidden');
    document.getElementById('settings-panel-notifications')?.classList.add('hidden');
    document.getElementById('settings-panel-security')?.classList.add('hidden');

    const target = document.getElementById(`settings-panel-${tabName}`);
    if (target) target.classList.remove('hidden');
}

function loadSavedSettings() {
    try {
        const savedProfile = localStorage.getItem('claimproof_user_profile');
        if (savedProfile) {
            const data = JSON.parse(savedProfile);
            if (data.name) state.userName = data.name;
            if (data.email) state.userEmail = data.email;
            if (data.phone) state.userPhone = data.phone;

            const nameInput = document.getElementById('settings-name-input');
            const emailInput = document.getElementById('settings-email-input');
            const phoneInput = document.getElementById('settings-phone-input');

            if (nameInput) nameInput.value = state.userName;
            if (emailInput) emailInput.value = state.userEmail;
            if (phoneInput) phoneInput.value = state.userPhone;

            updateUserDisplayNames(state.userName);
        }

        const savedNotifs = localStorage.getItem('claimproof_notifications');
        if (savedNotifs) {
            const notifs = JSON.parse(savedNotifs);
            const t1 = document.getElementById('notif-needs-info');
            const t2 = document.getElementById('notif-ai-check');
            const t3 = document.getElementById('notif-policy-updates');

            if (t1 && notifs.needsInfo !== undefined) t1.checked = notifs.needsInfo;
            if (t2 && notifs.aiCheck !== undefined) t2.checked = notifs.aiCheck;
            if (t3 && notifs.policyUpdates !== undefined) t3.checked = notifs.policyUpdates;
        }
    } catch (e) {
        console.warn('Settings load error:', e);
    }
}

function saveSettingsProfile() {
    const nameInput = document.getElementById('settings-name-input');
    const emailInput = document.getElementById('settings-email-input');
    const phoneInput = document.getElementById('settings-phone-input');
    const btn = document.getElementById('btn-save-profile');
    const label = document.getElementById('btn-save-profile-label');

    const newName = nameInput ? nameInput.value.trim() : '';
    const newEmail = emailInput ? emailInput.value.trim() : '';
    const newPhone = phoneInput ? phoneInput.value.trim() : '';

    if (!newName) {
        showToast('Validation Error', 'Please enter your full name.', 'warning');
        return;
    }

    if (btn && label) {
        btn.disabled = true;
        label.innerText = 'Saving Changes...';
    }

    setTimeout(() => {
        state.userName = newName;
        state.userEmail = newEmail;
        state.userPhone = newPhone;

        updateUserDisplayNames(newName);

        localStorage.setItem('claimproof_user_profile', JSON.stringify({
            name: newName,
            email: newEmail,
            phone: newPhone
        }));

        if (btn && label) {
            btn.disabled = false;
            label.innerText = 'Save Changes';
        }

        showToast('Profile Saved', 'Personal information updated successfully.', 'success');
    }, 350);
}

function updateUserDisplayNames(newName) {
    document.querySelectorAll('.user-name, .user-display-name').forEach(el => el.innerText = newName);
    
    // Update welcome hero
    const heroTitle = document.querySelector('.hero-heading');
    if (heroTitle) {
        const firstName = newName.split(' ')[0] || newName;
        heroTitle.innerText = `Welcome back, ${firstName}`;
    }

    // Update avatar initials
    const initials = newName.split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase();
    document.querySelectorAll('.avatar-circle, .user-avatar-sm').forEach(el => el.innerText = initials || 'JG');
}

function saveNotificationPreferences() {
    const btn = document.getElementById('btn-save-notifications');
    const label = document.getElementById('btn-save-notif-label');

    const t1 = document.getElementById('notif-needs-info');
    const t2 = document.getElementById('notif-ai-check');
    const t3 = document.getElementById('notif-policy-updates');

    if (btn && label) {
        btn.disabled = true;
        label.innerText = 'Saving Preferences...';
    }

    setTimeout(() => {
        const preferences = {
            needsInfo: t1 ? t1.checked : true,
            aiCheck: t2 ? t2.checked : true,
            policyUpdates: t3 ? t3.checked : true
        };

        localStorage.setItem('claimproof_notifications', JSON.stringify(preferences));

        if (btn && label) {
            btn.disabled = false;
            label.innerText = 'Save Preferences';
        }

        showToast('Preferences Saved', 'Your notification settings have been updated.', 'success');
    }, 300);
}


/* ========================================== */
/* DEDICATED UPLOAD DOCUMENT MODAL LOGIC       */
/* ========================================== */

function openUploadDocumentModal(targetDocType) {
    const claim = state.activeClaim || (state.claimsList.length > 0 ? state.claimsList[0] : null);
    
    const claimIdEl = document.getElementById('upload-modal-claim-id');
    const claimTypeEl = document.getElementById('upload-modal-claim-type');
    const selectEl = document.getElementById('upload-doc-type-select');

    if (claimIdEl) claimIdEl.innerText = claim ? claim.claim_id : 'CLM-CUSTOM-001';
    if (claimTypeEl) claimTypeEl.innerText = claim?.incident_type ? `${claim.incident_type.charAt(0).toUpperCase() + claim.incident_type.slice(1)} Claim` : 'Accident Claim';

    if (selectEl && targetDocType) {
        selectEl.value = targetDocType;
    }

    resetUploadModalToIdle();
    document.getElementById('modal-upload-document')?.classList.remove('hidden');
}

function closeUploadDocumentModal() {
    document.getElementById('modal-upload-document')?.classList.add('hidden');
}

function resetUploadModalToIdle() {
    document.getElementById('upload-state-idle')?.classList.remove('hidden');
    document.getElementById('upload-state-progress')?.classList.add('hidden');
    document.getElementById('upload-state-success')?.classList.add('hidden');
    document.getElementById('upload-state-error')?.classList.add('hidden');

    clearSelectedUploadFile();
}

function handleDocTypeChange() {
    // If a file is selected, update displayed name recommendation if needed
    const select = document.getElementById('upload-doc-type-select');
    if (!select) return;
}

function setupUploadDropzoneListeners() {
    const dropzone = document.getElementById('upload-doc-dropzone');
    const fileInput = document.getElementById('upload-doc-file-input');

    if (!dropzone || !fileInput) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.style.borderColor = 'var(--primary)';
            dropzone.style.backgroundColor = 'rgba(37, 99, 235, 0.08)';
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.style.borderColor = '';
            dropzone.style.backgroundColor = '';
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            handleSelectedUploadFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (fileInput.files && fileInput.files.length > 0) {
            handleSelectedUploadFile(fileInput.files[0]);
        }
    });
}

function handleSelectedUploadFile(file) {
    state.selectedUploadFile = file;

    const preview = document.getElementById('upload-selected-file-preview');
    const nameEl = document.getElementById('upload-file-name');
    const sizeEl = document.getElementById('upload-file-size');
    const uploadBtn = document.getElementById('btn-start-upload');

    if (nameEl) nameEl.innerText = file.name;
    if (sizeEl) sizeEl.innerText = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    if (preview) preview.classList.remove('hidden');
    if (uploadBtn) uploadBtn.disabled = false;
}

function clearSelectedUploadFile() {
    state.selectedUploadFile = null;
    const fileInput = document.getElementById('upload-doc-file-input');
    if (fileInput) fileInput.value = '';

    const preview = document.getElementById('upload-selected-file-preview');
    if (preview) preview.classList.add('hidden');

    const uploadBtn = document.getElementById('btn-start-upload');
    // If no file, allow uploading default mock evidence on button click
    if (uploadBtn) uploadBtn.disabled = false;
}

function startDocumentUploadProcess() {
    const docTypeSelect = document.getElementById('upload-doc-type-select');
    const docType = docTypeSelect ? docTypeSelect.value : 'driving_licence';
    const docTitle = docType.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    // Switch to progress state
    document.getElementById('upload-state-idle')?.classList.add('hidden');
    document.getElementById('upload-state-progress')?.classList.remove('hidden');

    const progressBar = document.getElementById('upload-progress-bar-fill');
    const progressPercent = document.getElementById('upload-progress-percent');
    const step1 = document.getElementById('ustep-1');
    const step2 = document.getElementById('ustep-2');
    const step3 = document.getElementById('ustep-3');
    const step4 = document.getElementById('ustep-4');

    // Stage 1: File transferred (300ms)
    setTimeout(() => {
        if (progressBar) progressBar.style.width = '45%';
        if (progressPercent) progressPercent.innerText = '45%';
        if (step1) step1.className = 'mini-step complete';
        if (step2) step2.className = 'mini-step active';
    }, 350);

    // Stage 2: Extracting text & metadata (700ms)
    setTimeout(() => {
        if (progressBar) progressBar.style.width = '75%';
        if (progressPercent) progressPercent.innerText = '75%';
        if (step2) step2.className = 'mini-step complete';
        if (step3) step3.className = 'mini-step active';
    }, 750);

    // Stage 3: Validating against policy clause (1100ms)
    setTimeout(() => {
        if (progressBar) progressBar.style.width = '95%';
        if (progressPercent) progressPercent.innerText = '95%';
        if (step3) step3.className = 'mini-step complete';
        if (step4) step4.className = 'mini-step active';
    }, 1150);

    // Stage 4: Completed (1500ms)
    setTimeout(() => {
        if (progressBar) progressBar.style.width = '100%';
        if (progressPercent) progressPercent.innerText = '100%';
        if (step4) step4.className = 'mini-step complete';

        // Apply state updates to activeClaim
        const claim = state.activeClaim || (state.claimsList.length > 0 ? state.claimsList[0] : null);
        if (claim) {
            // 1. Remove from missing_documents
            if (claim.completeness?.missing_documents) {
                claim.completeness.missing_documents = claim.completeness.missing_documents.filter(d => d !== docType);
            }

            // 2. If no more missing documents, upgrade recommendation to APPROVE
            if (claim.completeness?.missing_documents?.length === 0) {
                claim.recommendation = 'APPROVE';
            }

            // 3. Add to evidence items
            const fileName = state.selectedUploadFile ? state.selectedUploadFile.name : `${docTitle.replace(/\s+/g, '_')}_Verified.pdf`;
            if (!claim.evidence_items) claim.evidence_items = [];
            claim.evidence_items.push({
                source_document: fileName,
                field_name: docType,
                value: 'Verified Valid',
                confidence: 0.99
            });

            // 4. Add to state documentsList
            state.documentsList.push({
                name: fileName,
                type: docTitle,
                claimId: claim.claim_id,
                date: new Date().toISOString().split('T')[0],
                status: 'Verified'
            });

            // 5. Re-render UI components
            updateDashboardPriorityCard();
            renderWorkspace(claim);
            renderDashboardRecentTable();
            renderClaimsTable();
            renderDocumentsTable();
            renderMissingDocumentsView();
        }

        // Show Success State
        document.getElementById('upload-state-progress')?.classList.add('hidden');
        document.getElementById('upload-state-success')?.classList.remove('hidden');

        const successMsg = document.getElementById('upload-success-message');
        if (successMsg) {
            successMsg.innerHTML = `<strong>${docTitle}</strong> has been parsed and verified. Your claim readiness is now <strong>100% Ready for Submission</strong>.`;
        }

        showToast('Document Uploaded', `${docTitle} verified and added to ${claim ? claim.claim_id : 'claim'}.`, 'success');

    }, 1550);
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
        <span class="status-badge ${getBadgeClass(pa.classification)}"><span class="badge-icon-symbol">${getStatusSymbol(pa.classification)}</span> ${pa.classification}</span>
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
        div.style.borderBottom = '1px solid var(--border)';
        div.innerHTML = `<span class="important-value">${item.title}</span>`;
        div.onclick = item.action;
        list.appendChild(div);
    });
}

function closeAllOverlays() {
    closeStartClaimModal();
    closeUploadDocumentModal();
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

function getStatusSymbol(status) {
    if (!status) return '✓';
    const s = status.toUpperCase();
    if (s === 'APPROVE' || s === 'READY' || s === 'SUPPORTED' || s === 'COMPLETE') return '✓';
    if (s === 'REQUEST_INFORMATION' || s === 'REQ_INFO' || s === 'WARNING' || s === 'ESCALATE') return '!';
    if (s === 'REJECT' || s === 'BLOCKED' || s === 'MISSING') return '✕';
    return '✓';
}

function getBadgeClass(status) {
    if (!status) return 'approve';
    const s = status.toUpperCase();
    if (s === 'APPROVE' || s === 'READY' || s === 'SUPPORTED' || s === 'COMPLETE') return 'approve';
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
        <span style="font-weight:600; color:${type === 'success' ? 'var(--success)' : type === 'warning' ? 'var(--warning)' : 'var(--info)'};">${type === 'success' ? '✓' : type === 'warning' ? '!' : 'ℹ'} ${title}:</span>
        <span style="color:var(--text-secondary);">${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
