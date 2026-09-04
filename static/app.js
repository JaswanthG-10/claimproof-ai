document.addEventListener('DOMContentLoaded', () => {
    checkHealth();
    setupFormListeners();
});

async function checkHealth() {
    const statusEl = document.getElementById('health-status');
    try {
        const response = await fetch('/health');
        const data = await response.json();
        if (data.status === 'ok') {
            const keyText = data.gemini_configured ? 'Gemini 3.5 Active' : 'Fallback Engine (Key Missing)';
            statusEl.innerHTML = `<span class="status-indicator ready"></span> System Operational (${keyText})`;
        } else {
            statusEl.innerHTML = `<span class="status-indicator loading"></span> System Warning`;
        }
    } catch (e) {
        statusEl.innerHTML = `<span class="status-indicator loading"></span> Server Connection Error`;
    }
}

function setupFormListeners() {
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await uploadCustomClaim();
        });
    }
}

async function runDemoCase(caseId) {
    showLoading();
    try {
        const response = await fetch(`/api/demo-cases/${caseId}/analyze`, {
            method: 'POST'
        });
        if (!response.ok) {
            throw new Error(`Error analyzing demo case: ${response.statusText}`);
        }
        const data = await response.json();
        renderClaimReview(data);
    } catch (error) {
        alert(`Failed to analyze demo case: ${error.message}`);
        showEmpty();
    }
}

async function uploadCustomClaim() {
    const claimId = document.getElementById('claim-id-input').value;
    const fileInput = document.getElementById('file-input');

    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select at least one document to upload.');
        return;
    }

    const formData = new FormData();
    formData.append('claim_id', claimId);
    for (let i = 0; i < fileInput.files.length; i++) {
        formData.append('files', fileInput.files[i]);
    }

    showLoading();

    try {
        const response = await fetch('/api/claims/analyze', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload analysis failed: ${response.statusText}`);
        }

        const data = await response.json();
        renderClaimReview(data);
    } catch (error) {
        alert(`Failed to analyze custom claim: ${error.message}`);
        showEmpty();
    }
}

function showLoading() {
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('claim-details').classList.add('hidden');
    document.getElementById('loading-state').classList.remove('hidden');
}

function showEmpty() {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('claim-details').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
}

function renderClaimReview(data) {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    const claimContainer = document.getElementById('claim-details');
    claimContainer.classList.remove('hidden');

    // 1. Recommendation Banner
    const banner = document.getElementById('recommendation-banner');
    const recStatus = document.getElementById('rec-status');
    const recSummary = document.getElementById('rec-summary');
    const recExplanation = document.getElementById('rec-explanation');

    const recType = data.recommendation;
    banner.className = `recommendation-banner ${recType.toLowerCase()}`;
    recStatus.innerText = recType.replace('_', ' ');

    let summary = "";
    if (recType === 'APPROVE') summary = "All mandatory requirements verified & supported.";
    else if (recType === 'REQUEST_INFORMATION') summary = "Mandatory required documentation missing.";
    else if (recType === 'ESCALATE') summary = "Material factual mismatch or policy ambiguity.";
    else if (recType === 'REJECT') summary = "Policy exclusion or limit violation triggered.";

    recSummary.innerText = summary;
    recExplanation.innerText = data.explanation || "No explanation generated.";

    // 2. Claim Overview
    document.getElementById('meta-claim-id').innerText = data.claim_id;
    document.getElementById('meta-customer').innerText = data.customer_name;
    document.getElementById('meta-vehicle').innerText = data.vehicle_number;
    document.getElementById('meta-type').innerText = (data.incident_type || 'Accident').toUpperCase();
    document.getElementById('meta-date').innerText = data.incident_date;
    document.getElementById('meta-amount').innerText = `INR ${Number(data.claimed_amount).toLocaleString('en-IN')}`;

    // 3. Document Completeness
    const compBadge = document.getElementById('completeness-badge');
    const docsList = document.getElementById('docs-checklist');
    const isComplete = data.completeness.is_complete;

    compBadge.innerText = isComplete ? 'COMPLETE' : 'INCOMPLETE';
    compBadge.className = `badge ${isComplete ? 'success' : 'warning'}`;

    docsList.innerHTML = '';
    const reqDocs = data.completeness.required_documents || [];
    const missingDocs = data.completeness.missing_documents || [];

    reqDocs.forEach(doc => {
        const isMissing = missingDocs.includes(doc);
        const item = document.createElement('div');
        item.className = `doc-item ${isMissing ? 'missing' : 'complete'}`;
        item.innerHTML = `
            <span>${isMissing ? '❌' : '✅'}</span>
            <strong>${doc.replace('_', ' ').toUpperCase()}</strong>
        `;
        docsList.appendChild(item);
    });

    // 4. Contradictions Section
    const contradictionSection = document.getElementById('contradictions-section');
    const contradictionList = document.getElementById('contradictions-list');
    const contradictions = data.contradictions || [];

    if (contradictions.length > 0) {
        contradictionSection.classList.remove('hidden');
        contradictionList.innerHTML = '';
        contradictions.forEach(c => {
            const box = document.createElement('div');
            box.className = 'contradiction-box';
            box.innerHTML = `
                <div class="contradiction-header">⚠️ Field Conflict: ${c.field_name.replace('_', ' ').toUpperCase()}</div>
                <p style="font-size: 0.85rem; color: #94a3b8;">${c.description}</p>
                <div class="contradiction-comparison">
                    <div class="source-item">
                        <strong>Source A:</strong> ${c.source_a} (Page ${c.page_a})<br>
                        <strong>Value:</strong> <span style="color: #ef4444;">${c.value_a}</span>
                    </div>
                    <div class="source-item">
                        <strong>Source B:</strong> ${c.source_b} (Page ${c.page_b})<br>
                        <strong>Value:</strong> <span style="color: #ef4444;">${c.value_b}</span>
                    </div>
                </div>
            `;
            contradictionList.appendChild(box);
        });
    } else {
        contradictionSection.classList.add('hidden');
    }

    // 5. Evidence Matrix Table
    const tbody = document.getElementById('evidence-table-body');
    tbody.innerHTML = '';
    const evidenceItems = data.evidence_items || [];

    if (evidenceItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No evidence items extracted.</td></tr>`;
    } else {
        evidenceItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.field_name}</strong></td>
                <td><code style="color: #38bdf8;">${item.value || 'null'}</code></td>
                <td>${item.source_document}</td>
                <td>Page ${item.page_number}</td>
                <td>${(item.confidence * 100).toFixed(0)}%</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 6. Policy Clause Analysis
    const policyGrid = document.getElementById('policy-clauses-grid');
    policyGrid.innerHTML = '';
    const policyAssessments = data.policy_assessments || [];

    policyAssessments.forEach(pa => {
        const card = document.createElement('div');
        card.className = 'policy-card';
        card.innerHTML = `
            <span class="clause-badge ${pa.classification}">${pa.classification}</span>
            <div class="policy-title">${pa.clause_id} - ${pa.clause_title} (Page ${pa.page})</div>
            <div class="policy-text">"${pa.clause_text}"</div>
            <div class="policy-reasoning"><strong>Reasoning:</strong> ${pa.reasoning}</div>
        `;
        policyGrid.appendChild(card);
    });

    // 7. Final Findings
    const findingsGrid = document.getElementById('findings-list');
    findingsGrid.innerHTML = '';
    const findings = data.findings || [];

    findings.forEach(f => {
        const card = document.createElement('div');
        card.className = 'finding-card';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
                <strong style="font-size:0.85rem; color:#38bdf8;">${f.category.toUpperCase()}</strong>
                <span class="clause-badge ${f.status}">${f.status}</span>
            </div>
            <p style="font-size:0.82rem;">${f.description}</p>
            ${f.policy_clause ? `<div style="font-size:0.75rem; color:#94a3b8; margin-top:0.3rem;">Citation: <strong>${f.policy_clause}</strong></div>` : ''}
        `;
        findingsGrid.appendChild(card);
    });
}
