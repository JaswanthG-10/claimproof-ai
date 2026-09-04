import re
from datetime import datetime
from typing import Optional, Tuple


MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12
}


def normalize_date(date_str: Optional[str]) -> Optional[str]:
    """
    Parse date from various Indian/International formats and normalize to YYYY-MM-DD.
    Supports:
      - YYYY-MM-DD, YYYY/MM/DD
      - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
      - MM/DD/YYYY (fallback)
      - Text dates: '21 August 2026', '21-Aug-2026', 'Aug 21, 2026'
    """
    if not date_str:
        return None

    cleaned = date_str.strip()
    # Remove leading/trailing quotes or brackets
    cleaned = re.sub(r"^['\"(\[]+|['\")\]]+$", "", cleaned).strip()

    # Direct match for ISO format YYYY-MM-DD
    m_iso = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$", cleaned)
    if m_iso:
        y, m, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        try:
            return datetime(y, m, d).strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Match DD-MM-YYYY or DD/MM/YYYY
    m_dmy = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$", cleaned)
    if m_dmy:
        d, m, y = int(m_dmy.group(1)), int(m_dmy.group(2)), int(m_dmy.group(3))
        # If month > 12, swap if possible
        if m > 12 and d <= 12:
            d, m = m, d
        try:
            return datetime(y, m, d).strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Match textual dates like "21 August 2026" or "21-Aug-2026"
    m_text1 = re.match(r"^(\d{1,2})[\s\-]+([A-Za-z]+)[\s,\-]+(\d{4})$", cleaned)
    if m_text1:
        d, mon_str, y = int(m_text1.group(1)), m_text1.group(2).lower(), int(m_text1.group(3))
        if mon_str in MONTH_MAP:
            m = MONTH_MAP[mon_str]
            try:
                return datetime(y, m, d).strftime("%Y-%m-%d")
            except ValueError:
                pass

    # Match textual dates like "August 21, 2026"
    m_text2 = re.match(r"^([A-Za-z]+)[\s]+(\d{1,2})[\s,]+(\d{4})$", cleaned)
    if m_text2:
        mon_str, d, y = m_text2.group(1).lower(), int(m_text2.group(2)), int(m_text2.group(3))
        if mon_str in MONTH_MAP:
            m = MONTH_MAP[mon_str]
            try:
                return datetime(y, m, d).strftime("%Y-%m-%d")
            except ValueError:
                pass

    # Try general datetime strptime fallbacks
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            dt = datetime.strptime(cleaned, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def normalize_vehicle_number(v_num: Optional[str]) -> Optional[str]:
    """Standardize vehicle registration number to uppercase without punctuation/spaces."""
    if not v_num:
        return None
    val = re.sub(r"[^A-Za-z0-9]", "", v_num).upper()
    return val if len(val) >= 4 else None


def normalize_policy_number(p_num: Optional[str]) -> Optional[str]:
    """Standardize policy number."""
    if not p_num:
        return None
    val = re.sub(r"\s+", "", p_num).upper()
    return val if len(val) >= 3 else None


def normalize_amount(amount_val: Any) -> Optional[float]:
    """Parse numeric amount from currency string or number."""
    if amount_val is None:
        return None
    if isinstance(amount_val, (int, float)):
        return float(amount_val)
    s = str(amount_val).strip()
    # Remove currency symbols and formatting
    cleaned = re.sub(r"[INR|Rs|₹|\$|,\s]", "", s, flags=re.IGNORECASE)
    try:
        return float(cleaned)
    except ValueError:
        return None


def amounts_are_compatible(amt1: Optional[float], amt2: Optional[float], tolerance_pct: float = 0.005, abs_tolerance: float = 100.0) -> bool:
    """
    Check if two amounts are consistent within standard tolerance.
    Tolerates minor rounding or deductible differences (<= 0.5% or <= INR 100).
    """
    if amt1 is None or amt2 is None:
        return True
    diff = abs(amt1 - amt2)
    if diff <= abs_tolerance:
        return True
    avg = (abs(amt1) + abs(amt2)) / 2.0
    if avg > 0 and (diff / avg) <= tolerance_pct:
        return True
    return False


def evaluate_commercial_use(text: str) -> Optional[bool]:
    """
    Evaluate if text indicates commercial vs private personal use.
    Returns:
      True: Confirmed commercial / taxi / fare / rideshare
      False: Confirmed private personal use
      None: Unknown / Not mentioned in text (DO NOT assume false)
    """
    t = text.lower()

    commercial_signals = [
        "commercial ride-share", "commercial rideshare", "ride-share taxi", "rideshare taxi",
        "paying passengers", "taxi fare", "commercial use", "commercial purpose",
        "carriage of goods for hire", "hired vehicle", "uber drop", "ola drop",
        "commercial passenger"
    ]

    private_signals = [
        "personal private commute", "private personal", "personal use",
        "private car", "personal driving", "family commute", "private commute"
    ]

    is_commercial = any(sig in t for sig in commercial_signals)
    is_private = any(sig in t for sig in private_signals)

    if is_commercial:
        return True
    if is_private:
        return False
    return None


def calculate_notification_days(incident_date_str: Optional[str], submission_date_str: Optional[str]) -> Optional[int]:
    """Calculate days between incident occurrence and claim submission."""
    inc_norm = normalize_date(incident_date_str)
    sub_norm = normalize_date(submission_date_str)

    if not inc_norm or not sub_norm:
        return None

    try:
        d_inc = datetime.strptime(inc_norm, "%Y-%m-%d")
        d_sub = datetime.strptime(sub_norm, "%Y-%m-%d")
        delta = (d_sub - d_inc).days
        return delta
    except Exception:
        return None


def is_licence_valid(expiry_date_str: Optional[str], incident_date_str: Optional[str]) -> Optional[bool]:
    """
    Check if driving licence was valid on the incident date.
    Returns:
      True: Valid (incident_date <= expiry_date)
      False: Expired (incident_date > expiry_date)
      None: Could not be determined
    """
    exp_norm = normalize_date(expiry_date_str)
    inc_norm = normalize_date(incident_date_str)

    if not exp_norm or not inc_norm:
        return None

    try:
        d_exp = datetime.strptime(exp_norm, "%Y-%m-%d")
        d_inc = datetime.strptime(inc_norm, "%Y-%m-%d")
        return d_inc <= d_exp
    except Exception:
        return None
