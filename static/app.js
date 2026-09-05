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
    initLoginMotion();
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
/* 3D MOTION & PARTICLE ENGINE FOR LOGIN      */
/* ========================================== */

let particleCanvas, particleCtx, particleAnimId;
let particles = [];
let mouseX = 0, mouseY = 0, targetMouseX = 0, targetMouseY = 0;

function initLoginMotion() {
    initParticleNetwork();
    initCardTilt();
}

function initParticleNetwork() {
    particleCanvas = document.getElementById('login-particle-canvas') || document.getElementById('login-3d-canvas');
    if (!particleCanvas) return;
    particleCtx = particleCanvas.getContext('2d');
    if (!particleCtx) return;

    function resize() {
        if (!particleCanvas) return;
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    particles = [];
    const count = Math.min(75, Math.max(35, Math.floor(window.innerWidth / 18)));
    const colors = ['rgba(99, 102, 241, ', 'rgba(6, 182, 212, ', 'rgba(129, 140, 248, '];

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * (particleCanvas.width || window.innerWidth),
            y: Math.random() * (particleCanvas.height || window.innerHeight),
            vx: (Math.random() - 0.5) * 0.65,
            vy: (Math.random() - 0.5) * 0.65,
            radius: Math.random() * 2 + 1.2,
            baseColor: colors[Math.floor(Math.random() * colors.length)],
            alpha: Math.random() * 0.45 + 0.35,
            pulseSpeed: Math.random() * 0.02 + 0.01,
            pulseOffset: Math.random() * Math.PI * 2
        });
    }

    // Mouse tracking for smooth parallax
    window.addEventListener('mousemove', (e) => {
        targetMouseX = (e.clientX - window.innerWidth / 2) * 0.04;
        targetMouseY = (e.clientY - window.innerHeight / 2) * 0.04;
    });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let time = 0;
    function renderParticles() {
        if (!particleCtx || !particleCanvas) return;
        particleAnimId = requestAnimationFrame(renderParticles);

        time += 0.015;
        mouseX += (targetMouseX - mouseX) * 0.08;
        mouseY += (targetMouseY - mouseY) * 0.08;

        particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

        const maxDist = 135;
        const width = particleCanvas.width;
        const height = particleCanvas.height;

        // Proximity connecting lines
        for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            const p1x = p1.x + mouseX * (p1.radius * 0.6);
            const p1y = p1.y + mouseY * (p1.radius * 0.6);

            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const p2x = p2.x + mouseX * (p2.radius * 0.6);
                const p2y = p2.y + mouseY * (p2.radius * 0.6);

                const dx = p1x - p2x;
                const dy = p1y - p2y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < maxDist) {
                    const lineAlpha = (1 - dist / maxDist) * 0.18;
                    particleCtx.strokeStyle = `rgba(99, 102, 241, ${lineAlpha})`;
                    particleCtx.lineWidth = 1;
                    particleCtx.beginPath();
                    particleCtx.moveTo(p1x, p1y);
                    particleCtx.lineTo(p2x, p2y);
                    particleCtx.stroke();
                }
            }
        }

        // Particle nodes
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (!prefersReducedMotion) {
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0) p.x = width;
                else if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                else if (p.y > height) p.y = 0;
            }

            const currentAlpha = p.alpha + Math.sin(time * p.pulseSpeed * 100 + p.pulseOffset) * 0.15;
            const px = p.x + mouseX * (p.radius * 0.6);
            const py = p.y + mouseY * (p.radius * 0.6);

            // Outer glow halo
            const grad = particleCtx.createRadialGradient(px, py, 0, px, py, p.radius * 3.5);
            grad.addColorStop(0, p.baseColor + Math.max(0.08, currentAlpha) + ')');
            grad.addColorStop(1, p.baseColor + '0)');

            particleCtx.fillStyle = grad;
            particleCtx.beginPath();
            particleCtx.arc(px, py, p.radius * 3.5, 0, Math.PI * 2);
            particleCtx.fill();

            // Core dot
            particleCtx.fillStyle = p.baseColor + '0.9)';
            particleCtx.beginPath();
            particleCtx.arc(px, py, p.radius, 0, Math.PI * 2);
            particleCtx.fill();
        }
    }

    renderParticles();
}

function initCardTilt() {
    const card = document.getElementById('login-card-container');
    const glow = document.getElementById('login-card-glow');
    if (!card) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let bounds;
    function updateBounds() {
        if (card) bounds = card.getBoundingClientRect();
    }
    updateBounds();
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds);

    card.addEventListener('mousemove', (e) => {
        if (!bounds) updateBounds();
        const mouseX = e.clientX - bounds.left;
        const mouseY = e.clientY - bounds.top;

        const xPct = mouseX / bounds.width;
        const yPct = mouseY / bounds.height;

        const tiltX = (0.5 - yPct) * 16;
        const tiltY = (xPct - 0.5) * 16;

        card.style.transform = `perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;

        if (glow) {
            glow.style.background = `radial-gradient(circle at ${mouseX}px ${mouseY}px, rgba(255, 255, 255, 0.16) 0%, rgba(99, 102, 241, 0.08) 35%, transparent 65%)`;
            glow.style.opacity = '1';
        }
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        if (glow) glow.style.opacity = '0';
    });
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


async function fetchPolicyClauses() {
    try {
        const res = await fetch('/api/policy/clauses');
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                state.policyClauses = data.map(c => {
                    let catName = 'COVERAGE';
                    let icon = '🛡️';
                    const c_cat = (c.category || '').toLowerCase();
                    if (c_cat.includes('exclusion')) {
                        catName = 'EXCLUSIONS';
                        icon = '🚫';
                    } else if (c_cat.includes('required')) {
                        catName = 'REQUIRED';
                        icon = '📋';
                    } else if (c_cat.includes('idv') || c_cat.includes('limit') || c_cat.includes('period') || c_cat.includes('window')) {
                        catName = 'IDV';
                        icon = '⚖️';
                    }
                    return {
                        clause_id: c.clause_id,
                        clause_title: c.clause_title,
                        category: catName,
                        icon: icon,
                        clause_text: c.clause_text,
                        reasoning: c.clause_title + ' (Page ' + c.page + ')',
                        page: c.page,
                        classification: 'SUPPORTED'
                    };
                });
            }
        }
    } catch (e) {
        console.warn('Could not load policy clauses from API:', e);
    }
}

async function fetchDemoCasesList() {
    try {
        await fetchPolicyClauses();
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

function formatDocName(doc) {
    if (!doc) return 'Document';
    return doc.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function escapeJsStr(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function renderWorkspace(claim) {
    if (!claim) return;

    // Header info
    document.getElementById('ws-claim-id').innerText = claim.claim_id;
    document.getElementById('ws-incident-badge').innerText = claim.incident_type ? claim.incident_type.charAt(0).toUpperCase() + claim.incident_type.slice(1) : 'Accident';

    const statusBadge = document.getElementById('ws-status-badge');
    const recType = (claim.recommendation || 'APPROVE').toUpperCase();
    statusBadge.innerHTML = `<span class="badge-icon-symbol">${getStatusSymbol(recType)}</span> ${claim.recommendation_label || formatRecText(recType)}`;
    statusBadge.className = `badge-status ${getBadgeClass(recType)}`;

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
        policyRow.innerHTML = `<span style="color:var(--success);">✓ Policy Schedule (Active POL-2026-104)</span>`;
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
            div.innerHTML = `<span style="color:var(--success);">✓ ${formatDocName(doc)}</span>`;
            
            const matchingEvidence = claim.evidence_items?.find(e => e.source_document && e.source_document.toLowerCase().includes(doc.toLowerCase()));
            const previewText = matchingEvidence?.raw_text || `Document: ${formatDocName(doc)}\nVerified against active policy POL-2026-104.\nStatus: Authentic and complete.`;
            div.onclick = () => openDocumentDrawer(`${doc}.pdf`, previewText);
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
                        <span style="color:var(--warning);">! ${formatDocName(doc)}</span>
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

    // Center Panel: Facts Grid
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

    // Dynamic AI Readiness Checks Container
    const checksContainer = document.getElementById('ws-ai-checks-container');
    const checksSummaryBadge = document.getElementById('ws-checks-summary-badge');
    if (checksContainer) {
        checksContainer.innerHTML = '';
        const findings = claim.findings || [];

        if (checksSummaryBadge) {
            const hasBlocked = findings.some(f => f.status === 'BLOCKED' || f.status === 'CONTRADICTED');
            const hasMissing = findings.some(f => f.status === 'MISSING' || f.status === 'UNCERTAIN');
            if (hasBlocked) {
                checksSummaryBadge.className = 'badge-status reject';
                checksSummaryBadge.innerHTML = '<span class="badge-icon-symbol">✗</span> Issues Detected';
            } else if (hasMissing) {
                checksSummaryBadge.className = 'badge-status request';
                checksSummaryBadge.innerHTML = '<span class="badge-icon-symbol">!</span> Incomplete';
            } else {
                checksSummaryBadge.className = 'badge-status approve';
                checksSummaryBadge.innerHTML = '<span class="badge-icon-symbol">✓</span> All Checks Passed';
            }
        }

        if (findings.length === 0) {
            checksContainer.innerHTML = `<div class="metadata-text" style="padding:12px;">No automated findings recorded.</div>`;
        } else {
            findings.forEach((f, idx) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'ai-check-item' + (idx > 0 ? ' mt-12' : '');

                let badgeClass = 'approve';
                let iconSymbol = '✓';
                let statusLabel = 'VERIFIED';
                let rowClass = 'positive';

                if (f.status === 'MISSING' || f.status === 'UNCERTAIN') {
                    badgeClass = 'request';
                    iconSymbol = '!';
                    statusLabel = f.status === 'MISSING' ? 'MISSING' : 'UNCERTAIN';
                    rowClass = 'warning';
                } else if (f.status === 'BLOCKED' || f.status === 'CONTRADICTED') {
                    badgeClass = 'reject';
                    iconSymbol = '✗';
                    statusLabel = f.status === 'CONTRADICTED' ? 'CONTRADICTION' : 'VIOLATION';
                    rowClass = 'danger';
                }

                const sourceDoc = f.source_document || 'Submitted Evidence';
                const pageNum = f.source_page || 1;
                const fieldName = f.source_field || 'Condition Verification';
                const previewSnippet = f.raw_evidence_text || f.description;

                let clauseBadgeHtml = '';
                if (f.policy_clause) {
                    clauseBadgeHtml = `<span class="clause-citation-tag">⚖ ${escapeHtml(f.policy_clause)}${f.policy_page ? ` (Page ${f.policy_page})` : ''}</span>`;
                }

                itemDiv.innerHTML = `
                    <div class="check-item-header">
                        <span class="check-title">${idx + 1}. ${(f.category || 'EVIDENCE CHECK').toUpperCase()}</span>
                        <span class="status-badge ${badgeClass}"><span class="badge-icon-symbol">${iconSymbol}</span> ${statusLabel}</span>
                    </div>
                    <div class="check-details mt-8">
                        <div class="check-sub-row ${rowClass}">${iconSymbol} ${escapeHtml(f.description)}</div>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:8px;">
                        <button class="evidence-citation-tag" onclick="openDocumentDrawer('${escapeHtml(sourceDoc)}', '${escapeJsStr(previewSnippet)}')">
                            📄 Source: ${escapeHtml(sourceDoc)} → Page ${pageNum} → ${escapeHtml(fieldName)}
                        </button>
                        ${clauseBadgeHtml}
                    </div>
                `;
                checksContainer.appendChild(itemDiv);
            });
        }
    }

    // Dynamic Policy Clause Evaluations Container
    const policyContainer = document.getElementById('ws-policy-checks-container');
    if (policyContainer) {
        policyContainer.innerHTML = '';
        const assessments = claim.policy_assessments || [];

        if (assessments.length === 0) {
            policyContainer.innerHTML = `<div class="metadata-text" style="padding:12px;">No specific policy clause evaluations recorded.</div>`;
        } else {
            assessments.forEach(pa => {
                const card = document.createElement('div');
                card.className = 'policy-card-cat';

                let badgeClass = 'approve';
                let iconSymbol = '✓';
                let statusLabel = 'PASS';
                if (pa.classification === 'BLOCKED') {
                    card.classList.add('cat-exclusions');
                    badgeClass = 'reject';
                    iconSymbol = '✗';
                    statusLabel = 'EXCLUSION';
                } else if (pa.classification === 'UNCERTAIN' || pa.classification === 'NOT_APPLICABLE') {
                    card.classList.add('cat-conditions');
                    badgeClass = 'request';
                    iconSymbol = '!';
                    statusLabel = 'CONDITIONAL';
                } else {
                    card.classList.add('cat-coverage');
                }

                card.innerHTML = `
                    <div class="card-header-flex">
                        <strong style="color:var(--text-primary); font-size:14px;">${escapeHtml(pa.clause_id)}: ${escapeHtml(pa.clause_title)}</strong>
                        <span class="status-badge ${badgeClass}"><span class="badge-icon-symbol">${iconSymbol}</span> ${statusLabel}</span>
                    </div>
                    <p class="body-text mt-8" style="font-size:13px; line-height:1.4;">${escapeHtml(pa.reasoning)}</p>
                    <div style="margin-top:10px;">
                        <span class="clause-citation-tag">⚖ Policy Document POL-2026-104 (Page ${pa.page || 1})</span>
                    </div>
                `;
                policyContainer.appendChild(card);
            });
        }
    }

    // Contradictions / Mismatches Cards
    const cCard = document.getElementById('ws-contradiction-card');
    const cContainer = document.getElementById('ws-contradictions-container');
    const contradictions = claim.contradictions || [];

    if (cCard && cContainer) {
        if (contradictions.length > 0) {
            cCard.classList.remove('hidden');
            const issuesBadge = document.getElementById('ws-issues-count-badge');
            if (issuesBadge) {
                issuesBadge.innerHTML = `<span class="badge-icon-symbol">!</span> ${contradictions.length} Issue${contradictions.length > 1 ? 's' : ''}`;
            }
            cContainer.innerHTML = '';

            contradictions.forEach(c => {
                const card = document.createElement('div');
                card.className = 'issue-card';
                card.innerHTML = `
                    <div class="issue-card-top">
                        <span class="issue-title">! ${(c.field_name || 'FIELD').replace('_', ' ').toUpperCase()} MISMATCH</span>
                        <span class="badge-status request"><span class="badge-icon-symbol">!</span> CONTRADICTION</span>
                    </div>
                    <div class="issue-desc">${escapeHtml(c.description)}</div>
                    <div class="issue-comparison-table">
                        <div class="comp-box">
                            <span>Source A (${escapeHtml(c.source_a)} P.${c.page_a})</span>
                            <strong>${escapeHtml(c.value_a)}</strong>
                        </div>
                        <div class="comp-box">
                            <span>Source B (${escapeHtml(c.source_b)} P.${c.page_b})</span>
                            <strong>${escapeHtml(c.value_b)}</strong>
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
    if (recCard) {
        recCard.className = `card-enterprise recommendation-panel ${recType.toLowerCase()}`;
    }
    
    const recTitleEl = document.getElementById('ws-rec-title');
    const recSummaryEl = document.getElementById('ws-rec-summary');
    const recExplanationEl = document.getElementById('ws-rec-explanation');
    const recGuidanceEl = document.getElementById('ws-rec-guidance');

    if (recTitleEl) recTitleEl.innerText = claim.recommendation_label || formatRecText(recType);

    if (claim.explanation) {
        if (recSummaryEl) recSummaryEl.innerText = claim.explanation.split('\n')[0];
    }

    if (claim.next_actions && claim.next_actions.length > 0) {
        if (recExplanationEl) {
            recExplanationEl.innerHTML = claim.next_actions.map(a => '• ' + escapeHtml(a)).join('<br>');
        }
    } else if (recType === 'APPROVE') {
        if (recExplanationEl) recExplanationEl.innerHTML = "✓ All mandatory documents available<br>✓ Valid coverage dates verified<br>✓ Repair estimate within policy limits";
    }

    if (recGuidanceEl) {
        recGuidanceEl.innerText = (claim.analysis_warnings && claim.analysis_warnings.length > 0) 
            ? claim.analysis_warnings.join(' | ') 
            : 'Preliminary AI Review — Subject to Formal Insurer Verification';
    }

    // Update global dashboard priority card and missing badges
    updateDashboardPriorityCard();
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
    {
        clause_id: 'Clause 1.1',
        clause_title: 'Insured Declared Value (IDV Limit)',
        category: 'IDV',
        icon: '💰',
        clause_text: 'The Insured Declared Value (IDV) of the vehicle is fixed at INR 8,00,000. Total claim liability for any single loss or damage shall not exceed this declared IDV limit.',
        reasoning: 'Maximum liability limit payable under policy schedule for accidental damage or total loss.',
        page: 1,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 1.2',
        clause_title: 'Policy Period & Active Validity',
        category: 'IDV',
        icon: '📅',
        clause_text: 'This Motor Comprehensive Policy is valid from 2026-01-01 to 2026-12-31. Loss or damage occurring outside this policy period is not covered under any circumstances.',
        reasoning: 'Verifies the incident date falls within the active calendar policy coverage window.',
        page: 1,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 2.1',
        clause_title: 'Accidental External Damage Cover',
        category: 'COVERAGE',
        icon: '🛡️',
        clause_text: 'Subject to terms and conditions, the Company indemnifies against accidental external damage, collision, fire, lightning, explosion, or malicious acts. Deductible applicable per claim: INR 1,000.',
        reasoning: 'Covers physical repairs and parts replacement up to the IDV limit subject to deductible.',
        page: 2,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 3.1',
        clause_title: 'Theft Coverage & Requirements',
        category: 'COVERAGE',
        icon: '🔒',
        clause_text: 'Loss of vehicle due to theft is covered up to IDV subject to immediate Police First Information Report (FIR), written notice within 7 days, submission of Police Final Non-Traceable Report, and transfer of RC and original keys.',
        reasoning: 'Applies to total loss when original keys, registration documents, and police non-traceable report are provided.',
        page: 3,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 4.1',
        clause_title: 'Exclusion - Invalid Driving Licence',
        category: 'EXCLUSIONS',
        icon: '🪪',
        clause_text: 'The Company shall not be liable for any loss or damage incurred while the vehicle is driven by or is under the control of any person who does not hold an effective and valid driving licence at the time of the accident.',
        reasoning: 'Driving without a valid, unexpired licence for the vehicle class completely excludes coverage.',
        page: 4,
        classification: 'BLOCKED'
    },
    {
        clause_id: 'Clause 4.2',
        clause_title: 'Exclusion - Prohibited Commercial Use',
        category: 'EXCLUSIONS',
        icon: '🚫',
        clause_text: 'The Company shall not be liable for any loss, damage, or third-party liability if the private personal vehicle is operated, rented, hired, or used for commercial purposes, rideshare taxi operations, or carriage of goods for hire or reward.',
        reasoning: 'Commercial ridesharing or taxi operations under a private vehicle policy strictly voids coverage.',
        page: 4,
        classification: 'BLOCKED'
    },
    {
        clause_id: 'Clause 4.3',
        clause_title: 'Exclusion - Intoxication & Illegal Driving',
        category: 'EXCLUSIONS',
        icon: '⚠️',
        clause_text: 'Any loss or damage occurring whilst the driver of the vehicle is under the influence of intoxicating liquor or drugs is strictly excluded from coverage.',
        reasoning: 'Claims involving intoxicated driving are strictly inadmissible.',
        page: 5,
        classification: 'BLOCKED'
    },
    {
        clause_id: 'Clause 4.4',
        clause_title: 'Exclusion - Consequential Loss & Wear and Tear',
        category: 'EXCLUSIONS',
        icon: '⚙️',
        clause_text: 'Consequential loss, depreciation, wear and tear, mechanical or electrical breakdown, failures or breakages are strictly excluded.',
        reasoning: 'Routine mechanical failures and non-accidental wear and tear are not reimbursable.',
        page: 5,
        classification: 'BLOCKED'
    },
    {
        clause_id: 'Clause 5.1',
        clause_title: 'Required Documents - Accidental Damage Claims',
        category: 'REQUIRED',
        icon: '📋',
        clause_text: 'For processing any accidental damage claim, the insured must submit: (1) Official Claim Form duly filled and signed, (2) Itemized Repair Estimate from authorized repair centre, (3) Valid Driving Licence of the driver at the time of accident, (4) Vehicle Registration Certificate (RC).',
        reasoning: 'Checklist of mandatory preliminary documents required before accidental damage review.',
        page: 6,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 5.2',
        clause_title: 'Required Documents - Theft Claims',
        category: 'REQUIRED',
        icon: '📁',
        clause_text: 'For processing any theft claim, the insured must submit: (1) Official Claim Form, (2) Police First Information Report (FIR), (3) Vehicle Registration Certificate (RC), (4) Original Vehicle Keys and ownership transfer documents.',
        reasoning: 'Mandatory documentation for preliminary theft claim evaluation.',
        page: 6,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 6.1',
        clause_title: 'Claim Notification Window (7 Days)',
        category: 'REQUIRED',
        icon: '⏱️',
        clause_text: 'Notice of any claim, accident, or theft must be given in writing to the Company immediately and within 7 calendar days of the occurrence of the incident.',
        reasoning: 'Notice must be lodged within 7 days of incident date to prevent prejudice to insurer investigation.',
        page: 7,
        classification: 'SUPPORTED'
    },
    {
        clause_id: 'Clause 7.1',
        clause_title: 'Maximum Insured Declared Value Limit',
        category: 'IDV',
        icon: '🏷️',
        clause_text: 'The maximum indemnity payable under this policy is strictly limited to the Insured Declared Value (IDV) of INR 8,00,000 specified in the Policy Schedule.',
        reasoning: 'Caps total insurer liability at INR 8,00,000.',
        page: 7,
        classification: 'SUPPORTED'
    }
];

function renderPolicyLibrary() {
    const grid = document.getElementById('policy-library-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const filter = (state.policyFilter || 'all').toLowerCase();
    const query = (state.policySearchQuery || '').toLowerCase();

    const clauseSource = (state.policyClauses && state.policyClauses.length > 0) ? state.policyClauses : MASTER_POLICY_CLAUSES;
    const filtered = clauseSource.filter(c => {
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

async function startDocumentUploadProcess() {
    const claim = state.activeClaim || (state.claimsList.length > 0 ? state.claimsList[0] : null);
    const claimId = claim ? claim.claim_id : 'CLM-CUSTOM-001';
    const file = state.selectedUploadFile;

    if (!file) {
        showToast('Selection Required', 'Please select a file to upload.', 'warning');
        return;
    }

    // Switch UI to progress state
    document.getElementById('upload-state-idle')?.classList.add('hidden');
    document.getElementById('upload-state-progress')?.classList.remove('hidden');

    const progressBar = document.getElementById('upload-progress-bar-fill');
    const progressPercent = document.getElementById('upload-progress-percent');
    const headline = document.getElementById('upload-progress-headline');
    const step1 = document.getElementById('ustep-1');
    const step2 = document.getElementById('ustep-2');
    const step3 = document.getElementById('ustep-3');
    const step4 = document.getElementById('ustep-4');

    if (progressBar) progressBar.style.width = '30%';
    if (progressPercent) progressPercent.innerText = '30%';
    if (headline) headline.innerText = 'Uploading Document...';
    if (step1) step1.className = 'mini-step active';

    try {
        const formData = new FormData();
        formData.append('file', file);

        if (step1) step1.className = 'mini-step complete';
        if (step2) step2.className = 'mini-step active';
        if (progressBar) progressBar.style.width = '60%';
        if (progressPercent) progressPercent.innerText = '60%';
        if (headline) headline.innerText = 'Analyzing Evidence & Verifying Policy...';

        const res = await fetch('/api/claims/' + encodeURIComponent(claimId) + '/documents', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || 'Server returned error ' + res.status);
        }

        if (step2) step2.className = 'mini-step complete';
        if (step3) step3.className = 'mini-step complete';
        if (step4) step4.className = 'mini-step complete';
        if (progressBar) progressBar.style.width = '100%';
        if (progressPercent) progressPercent.innerText = '100%';

        const updatedClaim = await res.json();

        // Update active claim and list with real server response
        state.activeClaim = updatedClaim;
        const idx = state.claimsList.findIndex(c => c.claim_id === updatedClaim.claim_id);
        if (idx >= 0) state.claimsList[idx] = updatedClaim;
        else state.claimsList.unshift(updatedClaim);

        // Add real uploaded document to state documentsList
        state.documentsList.push({
            name: file.name,
            type: updatedClaim.incident_type || 'Claim Evidence',
            claimId: updatedClaim.claim_id,
            date: new Date().toISOString().split('T')[0],
            status: updatedClaim.recommendation === 'APPROVE' ? 'Verified' : 'Under Review'
        });

        // Re-render UI components with real server data
        updateDashboardPriorityCard();
        renderWorkspace(updatedClaim);
        renderDashboardRecentTable();
        renderClaimsTable();
        renderDocumentsTable();
        renderMissingDocumentsView();

        // Switch to Success State
        document.getElementById('upload-state-progress')?.classList.add('hidden');
        document.getElementById('upload-state-success')?.classList.remove('hidden');

        const successMsg = document.getElementById('upload-success-message');
        if (successMsg) {
            const missingCount = updatedClaim.completeness?.missing_documents?.length || 0;
            const recLabel = updatedClaim.recommendation_label || formatRecText(updatedClaim.recommendation);
            const statusDetail = missingCount === 0 ? 'All Documents Available' : missingCount + ' document(s) pending';
            successMsg.innerHTML = '<strong>' + escapeHtml(file.name) + '</strong> has been processed. Readiness: <strong>' + recLabel + '</strong> (' + statusDetail + ').';
        }

        showToast('Document Uploaded', 'Claim ' + updatedClaim.claim_id + ' re-analyzed: ' + updatedClaim.recommendation, 'success');

    } catch (err) {
        document.getElementById('upload-state-progress')?.classList.add('hidden');
        document.getElementById('upload-state-error')?.classList.remove('hidden');
        const errMsg = document.getElementById('upload-error-message');
        if (errMsg) errMsg.innerText = 'Upload or analysis failed: ' + err.message;
        showToast('Upload Error', err.message, 'error');
    }
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
