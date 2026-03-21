"""
Grant or revoke the superAdmin custom claim on a Firebase user.

Usage:
    python backend/scripts/set_admin.py grant your@email.com
    python backend/scripts/set_admin.py revoke your@email.com

Requires GOOGLE_APPLICATION_CREDENTIALS or firebase-service-account.json
to be present (same as the main backend).
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import firebase_admin
from firebase_admin import credentials, auth

# Initialise Firebase Admin the same way the backend does
_SA_PATH = os.path.join(os.path.dirname(__file__), "../firebase-service-account.json")
if not firebase_admin._apps:
    if os.path.exists(_SA_PATH):
        cred = credentials.Certificate(_SA_PATH)
    else:
        cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)


def set_admin(email: str, grant: bool):
    user = auth.get_user_by_email(email)
    current = user.custom_claims or {}
    if grant:
        current["superAdmin"] = True
        auth.set_custom_user_claims(user.uid, current)
        print(f"✓ Granted superAdmin to {email} (uid: {user.uid})")
    else:
        current.pop("superAdmin", None)
        auth.set_custom_user_claims(user.uid, current)
        print(f"✓ Revoked superAdmin from {email} (uid: {user.uid})")
    print("  Note: the user must sign out and back in for the new token to take effect.")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("grant", "revoke"):
        print("Usage: python backend/scripts/set_admin.py grant|revoke <email>")
        sys.exit(1)

    action, email = sys.argv[1], sys.argv[2]
    set_admin(email, grant=(action == "grant"))
