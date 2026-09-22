import secrets

# No 0/O/1/I to keep codes readable when shared verbally in a hostel corridor.
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def invite_code(length: int = 6) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))
