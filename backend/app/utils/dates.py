"""Date helpers. All persistence is UTC; all 'day' and 'week' semantics are IST (Asia/Kolkata)."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def as_utc(dt: datetime) -> datetime:
    """SQLite returns naive datetimes; treat naive as UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def local_date(dt: datetime) -> date:
    return as_utc(dt).astimezone(IST).date()


def local_today() -> date:
    return datetime.now(IST).date()


def iso_week_label(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def parse_week_label(label: str) -> date:
    """'2026-W39' -> Monday of that ISO week."""
    y, w = label.upper().split("-W")
    return date.fromisocalendar(int(y), int(w), 1)


def week_bounds(label: str | None = None) -> tuple[datetime, datetime, str]:
    """Return (start_utc, end_utc, label) for the ISO week (Mon 00:00 IST .. next Mon 00:00 IST)."""
    monday = parse_week_label(label) if label else _monday_of(local_today())
    start_local = datetime(monday.year, monday.month, monday.day, tzinfo=IST)
    end_local = start_local + timedelta(days=7)
    return start_local.astimezone(UTC), end_local.astimezone(UTC), iso_week_label(monday)


def _monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def last_n_week_labels(n: int, today: date | None = None) -> list[str]:
    """Oldest -> newest, ending with the current week."""
    today = today or local_today()
    monday = _monday_of(today)
    return [iso_week_label(monday - timedelta(weeks=i)) for i in range(n - 1, -1, -1)]
