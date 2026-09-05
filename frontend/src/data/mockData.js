export const MOCK_CLAIMS = [
  {
    id: "CLM-2026-001",
    vehicleNumber: "TN00DM2026",
    vehicleModel: "Maruti Suzuki Swift Dzire",
    type: "Accident Claim",
    category: "Collision Damage",
    date: "2026-08-21",
    amount: 48750,
    status: "Approved",
    statusBadge: "approved",
    readiness: 100,
    policyNumber: "POL-2026-104",
    incidentLocation: "Mount Road, Chennai",
    driverName: "Jaswanth G",
    summary: "Vehicle sustained front bumper and headlamp assembly damage due to low-speed collision. All 4 mandatory evidence documents verified. Policy active and under IDV limit.",
    documents: [
      { name: "Claim Form", status: "Verified", file: "claim_form_signed.pdf", pages: 2, extracted: "Accident date: 2026-08-21 · Vehicle: TN00DM2026" },
      { name: "Repair Estimate", status: "Verified", file: "estimate_maruti_service.pdf", pages: 3, extracted: "Parts & Labor Total: ₹48,750 (Authorized Workshop)" },
      { name: "Registration Certificate", status: "Verified", file: "rc_smartcard.pdf", pages: 1, extracted: "Registered Owner: Jaswanth G · Chassis: MA3E...2026" },
      { name: "Driving Licence", status: "Verified", file: "dl_driver.pdf", pages: 1, extracted: "Valid Till: 2035-11-14 · Class: LMV-NT" }
    ],
    checks: [
      { id: "POL-2.1", title: "Accidental Damage Coverage", status: "Pass", citation: "Clause 2.1 — Loss or Damage to Insured Vehicle", note: "Damages match collision narrative with zero mechanical failure indicators." },
      { id: "POL-4.1", title: "Prompt Incident Notification", status: "Pass", citation: "Clause 4.1 — 48-Hour Notice Window", note: "Reported within 24 hours of occurrence." },
      { id: "POL-5.1", title: "Driver Eligibility & Licensing", status: "Pass", citation: "Clause 5.1 — Driver Clause", note: "Valid LMV license held at time of incident." },
      { id: "POL-7.2", title: "IDV Sum Insured Limits", status: "Pass", citation: "Clause 7.2 — Maximum Indemnity", note: "Estimate ₹48,750 is well within remaining IDV ₹8,00,000." }
    ],
    idvImpact: 48750
  },
  {
    id: "CLM-2026-002",
    vehicleNumber: "TN00DM2026",
    vehicleModel: "Maruti Suzuki Swift Dzire",
    type: "Accident Claim",
    category: "Side Impact Collision",
    date: "2026-08-28",
    amount: 72000,
    status: "Action Required",
    statusBadge: "warning",
    readiness: 78,
    policyNumber: "POL-2026-104",
    incidentLocation: "Anna Nagar Roundtana, Chennai",
    driverName: "Pending Verification",
    summary: "Claim submission complete except for valid Driving Licence copy. Required under Clause 5.1 before final payout authorization.",
    documents: [
      { name: "Claim Form", status: "Verified", file: "claim_form_signed.pdf", pages: 2, extracted: "Incident Date: 2026-08-28" },
      { name: "Repair Estimate", status: "Verified", file: "repair_quote_bodywork.pdf", pages: 2, extracted: "Total: ₹72,000" },
      { name: "Registration Certificate", status: "Verified", file: "rc_smartcard.pdf", pages: 1, extracted: "Vehicle: TN00DM2026" },
      { name: "Driving Licence", status: "Missing", file: null, pages: 0, extracted: "Missing document. Upload required." }
    ],
    checks: [
      { id: "POL-2.1", title: "Accidental Damage Coverage", status: "Pass", citation: "Clause 2.1 — Loss or Damage", note: "Covered peril." },
      { id: "POL-5.1", title: "Driver Eligibility Check", status: "Warning", citation: "Clause 5.1 — Driver Clause", note: "Cannot verify valid licensing without driver's licence upload." },
      { id: "POL-4.1", title: "Incident Reporting Window", status: "Pass", citation: "Clause 4.1 — Notification", note: "Reported within window." }
    ],
    idvImpact: 0
  },
  {
    id: "CLM-2026-003",
    vehicleNumber: "TN09XY9900",
    vehicleModel: "Hyundai i20 Asta",
    type: "Theft / Loss",
    category: "Component Theft",
    date: "2026-08-15",
    amount: 120000,
    status: "Under Review",
    statusBadge: "escalated",
    readiness: 85,
    policyNumber: "POL-2026-104",
    incidentLocation: "Velachery Parking Lot, Chennai",
    driverName: "Jaswanth G",
    summary: "Discrepancy detected between FIR date and Claim Form timestamp. Requires surveyor secondary review under Clause 4.3.",
    documents: [
      { name: "Claim Form", status: "Verified", file: "theft_claim_form.pdf", pages: 2, extracted: "Reported Theft: 2026-08-15 22:00" },
      { name: "Police FIR", status: "Warning", file: "fir_velachery_ps.pdf", pages: 2, extracted: "FIR lodged: 2026-08-18 10:30 (72h gap)" },
      { name: "Registration Certificate", status: "Verified", file: "rc_tn09.pdf", pages: 1, extracted: "Owner: Jaswanth G" }
    ],
    checks: [
      { id: "POL-3.2", title: "Theft & Total Loss Terms", status: "Pass", citation: "Clause 3.2 — Theft of Vehicle Components", note: "Catalytic converter theft is covered under comprehensive policy." },
      { id: "POL-4.3", title: "Police FIR Lodging Timeline", status: "Warning", citation: "Clause 4.3 — Mandatory FIR for Theft", note: "72-hour delay between incident and FIR requires explanatory declaration." }
    ],
    idvImpact: 0
  },
  {
    id: "CLM-2026-004",
    vehicleNumber: "KA01AB1234",
    vehicleModel: "Honda City V",
    type: "Accident Claim",
    category: "Exclusion / Racing",
    date: "2026-07-10",
    amount: 185000,
    status: "Rejected",
    statusBadge: "rejected",
    readiness: 40,
    policyNumber: "POL-2026-104",
    incidentLocation: "Madras International Circuit, Irungattukottai",
    driverName: "Unknown Driver",
    summary: "Incident occurred during unsanctioned speed trial / closed circuit track use. Explicitly excluded under General Exception Clause 1.2.",
    documents: [
      { name: "Claim Form", status: "Verified", file: "claim_track_damage.pdf", pages: 2, extracted: "Track event collision" },
      { name: "Repair Estimate", status: "Verified", file: "honda_dealer_bill.pdf", pages: 4, extracted: "Frame straightening: ₹1,85,000" }
    ],
    checks: [
      { id: "POL-1.2", title: "Speed Testing / Racing Exclusion", status: "Fail", citation: "Clause 1.2 — Excluded Perils", note: "Policy explicitly disclaims coverage for competitive racing or speed tests." }
    ],
    idvImpact: 0
  }
];

export const POLICY_SUMMARY = {
  policyNumber: "POL-2026-104",
  holderName: "Jaswanth G",
  vehicle: "Maruti Suzuki Swift Dzire VXI",
  regNumber: "TN00DM2026",
  baseIDV: 800000,
  utilizedIDV: 48750,
  remainingIDV: 751250,
  validityStart: "2026-01-01",
  validityEnd: "2026-12-31",
  ncbDiscount: "35%",
  policyType: "Comprehensive Private Car Package"
};

export const STATS = [
  {
    title: "Total Claims",
    value: "4",
    subtext: "+1 this month",
    changeType: "neutral",
    color: "blue"
  },
  {
    title: "Active Claims",
    value: "1",
    subtext: "Under Evidence Review",
    changeType: "warning",
    color: "amber"
  },
  {
    title: "Total Approved",
    value: "₹48,750",
    subtext: "99.2% Accuracy Rate",
    changeType: "positive",
    color: "emerald"
  },
  {
    title: "AI Score",
    value: "98%",
    subtext: "Evidence Grounded",
    changeType: "positive",
    color: "violet"
  }
];

export const NOTIFICATIONS = [
  {
    id: 1,
    title: "Action Required: CLM-2026-002",
    description: "Please upload your Driving Licence to complete policy Clause 5.1 verification.",
    time: "10m ago",
    unread: true,
    type: "warning"
  },
  {
    id: 2,
    title: "Claim Approved: CLM-2026-001",
    description: "Payout of ₹48,750 confirmed. Remaining IDV updated to ₹7,51,250.",
    time: "2h ago",
    unread: true,
    type: "success"
  },
  {
    id: 3,
    title: "Policy Active: POL-2026-104",
    description: "Coverage active through Dec 31, 2026. Zero penalty endorsements.",
    time: "1d ago",
    unread: false,
    type: "info"
  }
];
