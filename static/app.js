// ==========================================
// CLAIMPROOF AI - APPLICATION CONTROLLER & SPA
// ==========================================

const state = {
    currentView: 'welcome',
    sidebarCollapsed: false,
    activeClaim: null,
    claimsList: [],
    auditLogs: [],
    allPolicies: [],
    investigatorName: 'Jaswanth G.',
    investigatorDept: 'Motor Claims Review Team - South Region',
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
    // Login Form Submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    // Welcome Enter Button fallback
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

    // Policy filter chips
    document.querySelectorAll('#policy-filter-chips .filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#policy-filter-chips .filter-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.policyFilter = btn.getAttribute('data-policy-filter') || 'all';
            renderPolicyLibrary();
        });
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
/* THREE.JS 3D GRAPH VISUALIZATION            */
/* ========================================== */

let scene, camera, renderer, nodesGroup;
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;

function init3DScene() {
    const canvas = document.getElementById('canvas-3d');
    if (!canvas || typeof THREE === 'undefined') return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const container = canvas.parentElement;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 700;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080E19, 0.035);

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 24;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    nodesGroup = new THREE.Group();
    scene.add(nodesGroup);

    // Node Network Definition: Documents -> Evidence -> Policy -> Recommendation
    const stages = [
        { label: 'Documents', x: -9, color: 0x38BDF8, count: 4 },
        { label: 'Evidence', x: -3, color: 0x2563EB, count: 6 },
        { label: 'Policy', x: 3, color: 0x818CF8, count: 5 },
        { label: 'Recommendation', x: 9, color: 0x4ADE80, count: 3 }
    ];

    const nodePositions = [];
    const sphereGeo = new THREE.SphereGeometry(0.35, 16, 16);

    stages.forEach(stage => {
        const stageNodes = [];
        for (let i = 0; i < stage.count; i++) {
            const y = (i - (stage.count - 1) / 2) * 2.6 + (Math.random() - 0.5) * 0.4;
            const z = (Math.random() - 0.5) * 3;

            const mat = new THREE.MeshBasicMaterial({
                color: stage.color,
                wireframe: false
            });
            const mesh = new THREE.Mesh(sphereGeo, mat);
            mesh.position.set(stage.x, y, z);
            nodesGroup.add(mesh);

            // Subtle outer halo
            const haloGeo = new THREE.SphereGeometry(0.55, 12, 12);
            const haloMat = new THREE.MeshBasicMaterial({
                color: stage.color,
                transparent: true,
                opacity: 0.2,
                wireframe: true
            });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.position.set(stage.x, y, z);
            nodesGroup.add(halo);

            stageNodes.push({ x: stage.x, y, z, mesh, color: stage.color });
        }
        nodePositions.push(stageNodes);
    });

    // Draw connection lines between adjacent stages
    const lineMat = new THREE.LineBasicMaterial({
        color: 0x2563EB,
        transparent: true,
        opacity: 0.35
    });

    for (let s = 0; s < nodePositions.length - 1; s++) {
        const currStage = nodePositions[s];
        const nextStage = nodePositions[s + 1];

        currStage.forEach(n1 => {
            nextStage.forEach(n2 => {
                if (Math.random() > 0.45) return; // Connect subset of nodes for clean network look
                const points = [];
                points.push(new THREE.Vector3(n1.x, n1.y, n1.z));
                // Add curve midpoint
                const midX = (n1.x + n2.x) / 2;
                const midY = (n1.y + n2.y) / 2 + (Math.random() - 0.5) * 1.5;
                const midZ = (n1.z + n2.z) / 2 + (Math.random() - 0.5) * 1.5;
                points.push(new THREE.Vector3(midX, midY, midZ));
                points.push(new THREE.Vector3(n2.x, n2.y, n2.z));

                const curve = new THREE.CatmullRomCurve3(points);
                const curvePoints = curve.getPoints(20);
                const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
                const line = new THREE.Line(geometry, lineMat);
                nodesGroup.add(line);
            });
        });
    }

    // Add ambient particles background
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 28;
        posArray[i + 1] = (Math.random() - 0.5) * 18;
        posArray[i + 2] = (Math.random() - 0.5) * 14;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
        size: 0.08,
        color: 0x38BDF8,
        transparent: true,
        opacity: 0.6
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    nodesGroup.add(particles);

    // Mouse parallax listener
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    // Resize Handler
    window.addEventListener('resize', () => {
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });

    // Animation Loop
    if (prefersReducedMotion) {
        renderer.render(scene, camera);
        return;
    }

    let clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();

        // Parallax smooth interpolation
        targetX = mouseX * 0.8;
        targetY = mouseY * 0.8;

        nodesGroup.rotation.y += 0.0015;
        nodesGroup.rotation.x = Math.sin(elapsedTime * 0.4) * 0.04 + targetY * 0.1;
        nodesGroup.rotation.y += (targetX * 0.1 - nodesGroup.rotation.y) * 0.05;

        // Pulse particles opacity
        particleMat.opacity = 0.4 + Math.sin(elapsedTime * 1.5) * 0.2;

        renderer.render(scene, camera);
    }

    animate();
}


/* ========================================== */
/* LOGIN FORM HANDLER                         */
/* ========================================== */

function handleLoginSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('login-submit-btn');
    if (!btn) return enterWorkspace();

    const origContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:8px; vertical-align:middle;"></span> Signing in...`;

    setTimeout(() => {
        enterWorkspace();
        btn.disabled = false;
        btn.innerHTML = origContent;
    }, 450);
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
        showToast('Welcome to ClaimProof AI', 'Workspace ready for evidence evaluation.', 'success');
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

    // Header Breadcrumb
    const titles = {
        'dashboard': 'Dashboard',
        'claims': 'Claims List',
        'workspace': 'Claim Review Center',
        'documents': 'Document Library',
        'policies': 'Policy Library',
        'settings': 'Workspace Settings'
    };

    if (titles[viewName]) {
        document.getElementById('breadcrumb-current').innerText = titles[viewName];
    }

    // Refresh view data
    if (viewName === 'claims') renderClaimsTable();
    else if (viewName === 'documents') renderDocumentsTable();
    else if (viewName === 'policies') renderPolicyLibrary();
}


/* ========================================== */
/* DEMO CASE RUNNER & API INTEGRATION         */
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

    // Header info (Un-concatenated separate header)
    document.getElementById('ws-claim-id').innerText = claim.claim_id;
    document.getElementById('ws-incident-badge').innerText = claim.incident_type ? claim.incident_type.charAt(0).toUpperCase() + claim.incident_type.slice(1) : 'Accident';

    const statusBadge = document.getElementById('ws-status-badge');
    statusBadge.innerText = formatRecText(claim.recommendation);
    statusBadge.className = `badge-status ${getBadgeClass(claim.recommendation)}`;

    // Left Panel: Documents & Evidence (Missing vs Available)
    const reqDocs = claim.completeness?.required_documents || [];
    const missingDocs = claim.completeness?.missing_documents || [];
    const availableDocs = reqDocs.filter(d => !missingDocs.includes(d));

    const missingList = document.getElementById('ws-doc-missing-list');
    const availList = document.getElementById('ws-doc-available-list');
    missingList.innerHTML = '';
    availList.innerHTML = '';

    const recCount = availableDocs.length + 1; // including policy doc
    document.getElementById('ws-doc-counter').innerText = `${recCount} / 5 received`;

    if (missingDocs.length > 0) {
        missingDocs.forEach(doc => {
            const div = document.createElement('div');
            div.className = 'doc-status-row missing';
            div.innerHTML = `
                <span>✕ ${doc.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                <span class="badge-tag req">Required</span>
            `;
            missingList.appendChild(div);
        });
    } else {
        missingList.innerHTML = `<div class="metadata-text">✓ No required documents missing.</div>`;
    }

    // Always include policy in available
    const policyRow = document.createElement('div');
    policyRow.className = 'doc-status-row';
    policyRow.innerHTML = `
        <span>✓ Policy Document</span>
        <span class="badge-tag avail">10 clauses indexed</span>
    `;
    policyRow.onclick = () => navigateTo('policies');
    availList.appendChild(policyRow);

    availableDocs.forEach(doc => {
        const div = document.createElement('div');
        div.className = 'doc-status-row';
        div.innerHTML = `
            <span>✓ ${doc.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
            <span class="badge-tag avail">Available</span>
        `;
        div.onclick = () => openDocumentDrawer(`${doc}.pdf`, claim.evidence_items?.find(e => e.source_document.includes(doc))?.raw_text || "Document text layer content.");
        availList.appendChild(div);
    });

    // Center Panel: Definition Grid Facts
    document.getElementById('ws-fact-name').innerText = claim.customer_name || 'Arjun Mehta';
    document.getElementById('ws-fact-vehicle').innerText = claim.vehicle_number || 'TN00DM2026';
    document.getElementById('ws-fact-date').innerText = claim.incident_date || 'Not specified';
    document.getElementById('ws-fact-amount').innerText = claim.claimed_amount ? `₹${Number(claim.claimed_amount).toLocaleString('en-IN')}` : '₹0';

    // Contradictions / Structured Issue Cards
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

    // Evidence Table Body
    const evTbody = document.getElementById('ws-evidence-table-body');
    evTbody.innerHTML = '';
    (claim.evidence_items || []).forEach(item => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => openEvidenceDrawer(item);
        tr.innerHTML = `
            <td><strong>${item.field_name}</strong></td>
            <td><code style="color:#38BDF8; font-weight:600;">${item.value || 'null'}</code></td>
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
        card.className = 'policy-clause-card';
        card.onclick = () => openPolicyDrawer(pa);
        card.innerHTML = `
            <div class="clause-card-top">
                <span class="clause-id-title">${pa.clause_id} · ${pa.clause_title} (Page ${pa.page})</span>
                <span class="badge-status ${getBadgeClass(pa.classification)}">${pa.classification}</span>
            </div>
            <div class="clause-text-snippet">"${pa.clause_text}"</div>
            <button class="btn-link">View source →</button>
        `;
        policyGrid.appendChild(card);
    });

    // Right Panel: Recommendation Details
    const recCard = document.getElementById('ws-rec-card');
    const recType = claim.recommendation || 'APPROVE';
    recCard.className = `card-enterprise recommendation-panel ${recType.toLowerCase()}`;
    document.getElementById('ws-rec-title').innerText = formatRecText(recType);

    let summaryText = "";
    let guidanceText = "Review verified details and take the recommended review action below.";
    if (recType === 'APPROVE') {
        summaryText = "Complete documentation submitted, valid coverage dates, and repair estimate within limit.";
        guidanceText = "Approve claim package for settlement.";
    } else if (recType === 'REQUEST_INFORMATION') {
        summaryText = "Mandatory driving licence document is missing from the submitted claim package.";
        guidanceText = "Request missing driving licence from claimant before proceeding.";
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
/* GUIDED ACTION HIERARCHY RENDERER           */
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
    primaryBtn.innerText = primary.label;
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
            <td>${c.incident_type ? c.incident_type.toUpperCase() : 'ACCIDENT'}</td>
            <td>₹${Number(c.claimed_amount || 0).toLocaleString('en-IN')}</td>
            <td><span class="status-badge ${getBadgeClass(c.recommendation)}">${formatRecText(c.recommendation)}</span></td>
            <td><button class="btn-link">Open Review →</button></td>
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
            <td>₹${Number(c.claimed_amount || 0).toLocaleString('en-IN')}</td>
            <td><span class="status-badge ${getBadgeClass(c.recommendation)}">${formatRecText(c.recommendation)}</span></td>
            <td><button class="btn-link" onclick="openClaimWorkspace('${c.claim_id}')">Open Review</button></td>
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
            <td><span class="badge-neutral">${e.field_name.toUpperCase()}</span></td>
            <td>${state.activeClaim.claim_id}</td>
            <td>Page ${e.page_number}</td>
            <td><span class="badge-status success">Extracted</span></td>
            <td><button class="btn-link" onclick="openDocumentDrawer('${e.source_document}', '${e.raw_text || "Text snippet"}')">Preview</button></td>
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

        // Filter logic
        if (state.policyFilter !== 'all') {
            if (state.policyFilter === 'required' && !category.includes('REQUIRED') && !category.includes('DOCUMENT')) return;
            if (state.policyFilter === 'coverage' && !category.includes('COVERAGE')) return;
            if (state.policyFilter === 'exclusions' && !category.includes('EXCLUSION')) return;
            if (state.policyFilter === 'idv' && !category.includes('LIMIT') && !category.includes('IDV')) return;
        }

        const div = document.createElement('div');
        div.className = 'policy-clause-card';
        div.innerHTML = `
            <div class="clause-card-top">
                <span class="clause-id-title">${c.clause_id} · ${c.clause_title}</span>
                <div class="flex-column align-end">
                    <span class="badge-neutral">${category}</span>
                    <span class="metadata-text mt-4">Page ${c.page}</span>
                </div>
            </div>
            <div class="clause-text-snippet">"${c.clause_text}"</div>
            <button class="btn-link" onclick="openPolicyDrawer(${JSON.stringify(c).replace(/"/g, '&quot;')})">View source →</button>
        `;
        grid.appendChild(div);
    });
}


/* ========================================== */
/* WORKSPACE SETTINGS FORM HANDLER            */
/* ========================================== */

function saveSettingsProfile() {
    const newName = document.getElementById('settings-name-input').value.trim();
    const newDept = document.getElementById('settings-dept-input').value.trim();

    if (newName) {
        state.investigatorName = newName;
        document.querySelectorAll('.user-name, .user-display-name').forEach(el => el.innerText = newName);
    }
    if (newDept) state.investigatorDept = newDept;

    showToast('Profile Updated', '✓ Profile updated successfully', 'success');
}


/* ========================================== */
/* INVESTIGATOR DECISION ACTIONS             */
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
    if (val.includes('flagged') || val.includes('mismatch')) {
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

function openNewClaimModal() { document.getElementById('modal-new-claim').classList.remove('hidden'); }
function closeNewClaimModal() { document.getElementById('modal-new-claim').classList.add('hidden'); }
function showProcessingModal() { document.getElementById('modal-processing').classList.remove('hidden'); }
function hideProcessingModal() { document.getElementById('modal-processing').classList.add('hidden'); }

function openDocumentDrawer(filename, text) {
    document.getElementById('drawer-doc-filename').innerText = filename;
    document.getElementById('drawer-doc-content').innerText = text || "Document text layer content loaded.";
    document.getElementById('drawer-document').classList.remove('hidden');
}

function openEvidenceDrawer(item) {
    const body = document.getElementById('drawer-evidence-body');
    body.innerHTML = `
        <div class="def-item mt-8"><span class="def-label">Field Name</span><strong class="def-value">${item.field_name}</strong></div>
        <div class="def-item mt-8"><span class="def-label">Extracted Value</span><strong class="def-value" style="color:#38BDF8;">${item.value}</strong></div>
        <div class="def-item mt-8"><span class="def-label">Source Document</span><strong class="def-value">${item.source_document} (Page ${item.page_number})</strong></div>
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
        <div class="mt-16"><strong>Why this clause applies:</strong><p style="font-size:13px; color:#CBD5E1; margin-top:4px;">${pa.reasoning}</p></div>
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
        { title: 'Case 2: Missing Driving Licence (NEED MORE INFO)', action: () => runDemoClaimFromModal('claim_002_request_information') },
        { title: 'Case 3: Date Contradiction (ESCALATE)', action: () => runDemoClaimFromModal('claim_003_escalate') },
        { title: 'Case 4: Commercial Ride-share Use (REJECT)', action: () => runDemoClaimFromModal('claim_004_reject') },
        { title: 'Open Policy Library', action: () => { toggleCommandPalette(); navigateTo('policies'); } },
        { title: 'Workspace Settings', action: () => { toggleCommandPalette(); navigateTo('settings'); } }
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
        <span style="font-weight:600;">${type === 'success' ? '✓' : type === 'warning' ? '⚠️' : 'ℹ️'} ${title}:</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
