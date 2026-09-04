import os
import fitz  # PyMuPDF


def create_pdf(filepath: str, pages_content: list[str]):
    """Create a PDF file with given list of page strings using PyMuPDF."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    doc = fitz.open()

    for content in pages_content:
        page = doc.new_page(width=595, height=842)  # A4 size
        # Margin 50, top 50
        rect = fitz.Rect(50, 50, 545, 792)
        # Insert text
        page.insert_textbox(rect, content, fontsize=11, fontname="helv")

    doc.save(filepath)
    doc.close()
    print(f"Created PDF: {filepath}")


def generate_synthetic_policy():
    policy_pdf_path = os.path.join("data", "policy", "synthetic_motor_policy.pdf")
    pages = [
        # Page 1
        """APEX MOTOR INSURANCE COMPANY LIMITED
POLICY SCHEDULE - PRIVATE CAR COMPREHENSIVE POLICY

SECTION 1 - POLICY DETAILS & COVERAGE LIMITS

Policy Number: POL-9928374-2026
Insured Name: Rajesh Sharma
Insured Vehicle: Hyundai Creta 1.5 Petrol
Vehicle Registration Number: KA01MJ4921
Year of Manufacture: 2024
Engine Number: ENG8839210
Chassis Number: CHS9938210

Policy Effective Start Date: 2026-01-01 (00:00 Hours)
Policy Expiry Date: 2026-12-31 (23:59 Hours)

Clause 1.1 - Insured Declared Value (IDV Limit):
The Insured Declared Value (IDV) of the vehicle is fixed at INR 8,00,000. Total claim liability for any single loss or damage shall not exceed this declared IDV limit.

Clause 1.2 - Policy Period:
This Motor Comprehensive Policy is valid from 2026-01-01 to 2026-12-31. Loss or damage occurring outside this policy period is not covered under any circumstances.""",

        # Page 2
        """APEX MOTOR INSURANCE COMPANY LIMITED

SECTION 2 - ACCIDENTAL DAMAGE COVER

Clause 2.1 - Accidental External Damage Cover:
Subject to the terms, exceptions, conditions and deductibles contained herein, the Company will indemnify the Insured against loss or damage to the vehicle insured and/or its accessories whilst thereon:
(a) by accidental external means or collision;
(b) by fire, explosion, self-ignition or lightning;
(c) by burglary, housebreaking or theft;
(d) by malicious act or vandalism;
(e) whilst in transit by road, rail, inland waterway, lift, elevator or air.

Deductible applicable per claim: INR 1,000 standard compulsory deductible.""",

        # Page 3
        """APEX MOTOR INSURANCE COMPANY LIMITED

SECTION 3 - THEFT COVERAGE

Clause 3.1 - Theft Coverage & Requirements:
In the event of total loss of the insured vehicle due to theft, the Company will pay the Insured Declared Value (IDV) subject to the following compulsory requirements:
1. Immediate notification to the Police and obtaining First Information Report (FIR).
2. Immediate written claim notification to the Company within 7 days.
3. Submission of Police Final Non-Traceable Report.
4. Transfer of vehicle Registration Certificate (RC) and delivery of all original vehicle ignition keys to the Company.""",

        # Page 4
        """APEX MOTOR INSURANCE COMPANY LIMITED

SECTION 4 - GENERAL EXCLUSIONS

Clause 4.1 Exclusion - Invalid Driving Licence:
The Company shall not be liable to make any payment in respect of any loss or damage caused or incurred while the vehicle is being driven by or is under the control of any person who does not hold an effective and valid driving licence at the time of the accident.

Clause 4.2 Exclusion - Prohibited Commercial Use:
The Company shall not be liable to make any payment in respect of any loss, damage, or third-party liability incurred if the private personal vehicle is operated, rented, hired, or used for commercial purposes, rideshare taxi operations (including Uber, Ola, or commercial transport), or carriage of goods for hire or reward.""",

        # Page 5
        """APEX MOTOR INSURANCE COMPANY LIMITED

SECTION 4 - GENERAL EXCLUSIONS (CONTINUED)

Clause 4.3 Exclusion - Intoxication & Illegal Driving:
Any loss or damage occurring whilst the driver of the vehicle is under the influence of intoxicating liquor or drugs is strictly excluded from coverage.

Clause 4.4 Exclusion - Consequential Loss & Wear & Tear:
Consequential loss, depreciation, wear and tear, mechanical or electrical breakdown, failures or breakages are strictly excluded.""",

        # Page 6
        """APEX MOTOR INSURANCE COMPANY LIMITED

SECTION 5 - MANDATORY REQUIRED DOCUMENTS

Clause 5.1 - Required Documents for Accidental Damage Claims:
For processing any accidental damage claim, the insured must submit the following complete documents:
(1) Official Claim Form duly filled and signed by policyholder
(2) Itemized Repair Estimate from authorized repair centre
(3) Valid Driving Licence of the person driving at the time of accident
(4) Vehicle Registration Certificate (RC)

Clause 5.2 - Required Documents for Theft Claims:
For processing any theft claim, the insured must submit:
(1) Official Claim Form
(2) Police First Information Report (FIR)
(3) Vehicle Registration Certificate (RC)
(4) Original Vehicle Keys and ownership transfer documents.""",

        # Page 7
        """APEX MOTOR INSURANCE COMPANY LIMITED

SECTION 6 - CLAIM NOTIFICATION WINDOW & IDV PROVISIONS

Clause 6.1 - Claim Notification Window:
Notice of any claim, accident, or theft must be given in writing to the Company immediately and within 7 calendar days of the occurrence of the incident. Delay in notification without valid justification may prejudice claim settlement.

Clause 7.1 - Insured Declared Value Limit:
The maximum indemnity payable under this policy is strictly limited to the Insured Declared Value (IDV) of INR 8,00,000 specified in the Policy Schedule."""
    ]

    create_pdf(policy_pdf_path, pages)


def generate_demo_claims():

    # ----------------------------------------------------
    # CASE 1: APPROVE (claim_001_approve)
    # ----------------------------------------------------
    dir_1 = os.path.join("data", "claims", "claim_001_approve")
    create_pdf(
        os.path.join(dir_1, "claim_form.pdf"),
        ["""APEX MOTOR INSURANCE - CLAIM FORM
Claim ID: CLAIM-2026-001
Policy Number: POL-9928374-2026
Customer Name: Rajesh Sharma
Vehicle Registration Number: KA01MJ4921
Vehicle Model: Hyundai Creta 1.5 Petrol
Driver Name: Rajesh Sharma
Incident Type: Accident
Incident Date: 2026-08-21
Incident Location: Indiranagar 100ft Road, Bengaluru
Estimated Claim Amount: INR 45,000
Vehicle Usage: Personal private commute"""]
    )
    create_pdf(
        os.path.join(dir_1, "repair_estimate.pdf"),
        ["""INDUS HYUNDAI AUTHORIZED SERVICE CENTER
REPAIR ESTIMATE & QUOTATION
Estimate No: EST-88391
Customer: Rajesh Sharma
Vehicle No: KA01MJ4921
Date: 2026-08-22
Line Items:
1. Front Bumper Assembly - INR 18,500
2. Headlight Unit Left - INR 14,000
3. Painting & Labor Charges - INR 12,500
Total Estimated Repair Cost: INR 45,000"""]
    )
    create_pdf(
        os.path.join(dir_1, "driving_licence.pdf"),
        ["""INDIAN DRIVING LICENCE
Licence No: KA01 2018009281
Name: Rajesh Sharma
DOB: 1990-05-14
Valid Up To: 2038-05-13
Authorised to Drive: LMV (Light Motor Vehicle - Private)"""]
    )
    create_pdf(
        os.path.join(dir_1, "registration_certificate.pdf"),
        ["""CERTIFICATE OF REGISTRATION
Registration No: KA01MJ4921
Owner Name: Rajesh Sharma
Vehicle Class: Motor Car (Private Personal)
Model: Hyundai Creta 1.5 Petrol
Chassis No: CHS9938210
Engine No: ENG8839210"""]
    )
    with open(os.path.join(dir_1, "incident_description.txt"), "w", encoding="utf-8") as f:
        f.write("Incident Description:\nOn 2026-08-21 at around 4:30 PM, I was driving my personal car Hyundai Creta near 100ft road Indiranagar when a heavy vehicle suddenly braked ahead, resulting in a minor front collision. Damaged front bumper and left headlight.")

    print("Created Case 1 (APPROVE)")

    # ----------------------------------------------------
    # CASE 2: REQUEST_INFORMATION (claim_002_request_information)
    # ----------------------------------------------------
    dir_2 = os.path.join("data", "claims", "claim_002_request_information")
    create_pdf(
        os.path.join(dir_2, "claim_form.pdf"),
        ["""APEX MOTOR INSURANCE - CLAIM FORM
Claim ID: CLAIM-2026-002
Policy Number: POL-9928374-2026
Customer Name: Rajesh Sharma
Vehicle Registration Number: KA01MJ4921
Vehicle Model: Hyundai Creta 1.5 Petrol
Driver Name: Rajesh Sharma
Incident Type: Accident
Incident Date: 2026-08-21
Incident Location: Koramangala 80ft Road, Bengaluru
Estimated Claim Amount: INR 32,000
Vehicle Usage: Personal private commute"""]
    )
    create_pdf(
        os.path.join(dir_2, "repair_estimate.pdf"),
        ["""INDUS HYUNDAI AUTHORIZED SERVICE CENTER
REPAIR ESTIMATE & QUOTATION
Estimate No: EST-88395
Customer: Rajesh Sharma
Vehicle No: KA01MJ4921
Date: 2026-08-22
Line Items:
1. Rear Bumper Panel - INR 20,000
2. Tail Light Assembly - INR 12,000
Total Estimated Repair Cost: INR 32,000"""]
    )
    create_pdf(
        os.path.join(dir_2, "registration_certificate.pdf"),
        ["""CERTIFICATE OF REGISTRATION
Registration No: KA01MJ4921
Owner Name: Rajesh Sharma
Vehicle Class: Motor Car (Private Personal)
Model: Hyundai Creta 1.5 Petrol"""]
    )
    with open(os.path.join(dir_2, "incident_description.txt"), "w", encoding="utf-8") as f:
        f.write("Incident Statement:\nCar hit from rear side at Koramangala traffic signal on 2026-08-21.")

    # Driving licence is intentionally omitted in Case 2!
    print("Created Case 2 (REQUEST_INFORMATION)")

    # ----------------------------------------------------
    # CASE 3: ESCALATE (claim_003_escalate)
    # ----------------------------------------------------
    dir_3 = os.path.join("data", "claims", "claim_003_escalate")
    create_pdf(
        os.path.join(dir_3, "claim_form.pdf"),
        ["""APEX MOTOR INSURANCE - CLAIM FORM
Claim ID: CLAIM-2026-003
Policy Number: POL-9928374-2026
Customer Name: Rajesh Sharma
Vehicle Registration Number: KA01MJ4921
Vehicle Model: Hyundai Creta 1.5 Petrol
Driver Name: Rajesh Sharma
Incident Type: Theft
Incident Date: 2026-08-21
Incident Location: MG Road Parking, Bengaluru
Estimated Claim Amount: INR 800,000
Vehicle Usage: Personal private commute"""]
    )
    create_pdf(
        os.path.join(dir_3, "fir.pdf"),
        ["""KARNATAKA POLICE DEPARTMENT
FIRST INFORMATION REPORT (FIR)
FIR No: FIR-2026-00892
Police Station: MG Road Police Station, Bengaluru
Complainant Name: Rajesh Sharma
Vehicle Registration Number: KA01MJ4921
Incident Type: Vehicle Theft (IPC 379)
Date of Occurrence: 2026-08-22
Time of Occurrence: 11:30 PM
Details: Vehicle parked at MG Road public lot was reported stolen on 2026-08-22 night."""]
    )
    create_pdf(
        os.path.join(dir_3, "repair_estimate.pdf"),
        ["""TOTAL LOSS CLAIM VALUE ESTIMATE
Vehicle Reg No: KA01MJ4921
Claimed Value (IDV Limit): INR 800,000"""]
    )
    create_pdf(
        os.path.join(dir_3, "driving_licence.pdf"),
        ["""INDIAN DRIVING LICENCE
Licence No: KA01 2018009281
Name: Rajesh Sharma
Valid Up To: 2038-05-13"""]
    )
    create_pdf(
        os.path.join(dir_3, "registration_certificate.pdf"),
        ["""CERTIFICATE OF REGISTRATION
Registration No: KA01MJ4921
Owner Name: Rajesh Sharma
Model: Hyundai Creta 1.5 Petrol"""]
    )
    with open(os.path.join(dir_3, "incident_description.txt"), "w", encoding="utf-8") as f:
        f.write("Incident Statement:\nVehicle stolen from MG road parking lot.")

    print("Created Case 3 (ESCALATE - Factual Mismatch in Date)")

    # ----------------------------------------------------
    # CASE 4: REJECT (claim_004_reject)
    # ----------------------------------------------------
    dir_4 = os.path.join("data", "claims", "claim_004_reject")
    create_pdf(
        os.path.join(dir_4, "claim_form.pdf"),
        ["""APEX MOTOR INSURANCE - CLAIM FORM
Claim ID: CLAIM-2026-004
Policy Number: POL-9928374-2026
Customer Name: Rajesh Sharma
Vehicle Registration Number: KA01MJ4921
Vehicle Model: Hyundai Creta 1.5 Petrol
Driver Name: Rajesh Sharma
Incident Type: Accident
Incident Date: 2026-08-21
Incident Location: Airport Road, Bengaluru
Estimated Claim Amount: INR 75,000
Vehicle Usage: Commercial Ride-share Taxi Fare Transport"""]
    )
    create_pdf(
        os.path.join(dir_4, "repair_estimate.pdf"),
        ["""INDUS HYUNDAI AUTHORIZED SERVICE CENTER
REPAIR ESTIMATE & QUOTATION
Estimate No: EST-88401
Customer: Rajesh Sharma
Vehicle No: KA01MJ4921
Date: 2026-08-22
Line Items:
1. Front Axle & Suspension Repair - INR 45,000
2. Side Body Panel & Painting - INR 30,000
Total Estimated Repair Cost: INR 75,000"""]
    )
    create_pdf(
        os.path.join(dir_4, "driving_licence.pdf"),
        ["""INDIAN DRIVING LICENCE
Licence No: KA01 2018009281
Name: Rajesh Sharma
Valid Up To: 2038-05-13"""]
    )
    create_pdf(
        os.path.join(dir_4, "registration_certificate.pdf"),
        ["""CERTIFICATE OF REGISTRATION
Registration No: KA01MJ4921
Owner Name: Rajesh Sharma
Vehicle Class: Motor Car (Private Personal)"""]
    )
    with open(os.path.join(dir_4, "incident_description.txt"), "w", encoding="utf-8") as f:
        f.write("Incident Statement:\nVehicle was carrying paying passengers for commercial ride-share taxi fare drop to Bengaluru Airport when collision occurred on Airport Road.")

    print("Created Case 4 (REJECT - Prohibited Commercial Use)")


if __name__ == "__main__":
    generate_synthetic_policy()
    generate_demo_claims()
