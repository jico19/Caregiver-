"""
Seed Test Accounts for Caregiver Platform
Creates test accounts for all roles (Administrator, Caregiver, Client)
with deterministic profiles. The seed password is NOT committed to the
repository - provide it via the SEED_TEST_PASSWORD environment variable.
"""
import os
import sys
from app.core.supabase import get_supabase

TEST_PASSWORD = os.environ.get("SEED_TEST_PASSWORD", "")

if not TEST_PASSWORD:
    print("ERROR: SEED_TEST_PASSWORD environment variable is required.", file=sys.stderr)
    print("Example: $env:SEED_TEST_PASSWORD='your-strong-password'; python seed_accounts.py", file=sys.stderr)
    sys.exit(1)

SEED_ACCOUNTS = [
    {
        "email": "admin@caregiver.com",
        "password": TEST_PASSWORD,
        "role": "administrator",
        "state_code": "FL",
        "first_name": "Admin",
        "last_name": "Director",
        "phone": "(555) 100-0001",
    },
    {
        "email": "caregiver.fl@caregiver.com",
        "password": TEST_PASSWORD,
        "role": "caregiver",
        "state_code": "FL",
        "first_name": "Sarah",
        "last_name": "Jenkins",
        "phone": "(555) 234-5678",
        "address": "100 Biscayne Blvd, Miami, FL 33132",
        "dob": "1988-04-12",
        "ssn_last4": "4321",
    },
    {
        "email": "caregiver.in@caregiver.com",
        "password": TEST_PASSWORD,
        "role": "caregiver",
        "state_code": "IN",
        "first_name": "Michael",
        "last_name": "Chang",
        "phone": "(555) 345-6789",
        "address": "200 N Meridian St, Indianapolis, IN 46204",
        "dob": "1992-09-25",
        "ssn_last4": "8765",
    },
    {
        "email": "caregiver.ga@caregiver.com",
        "password": TEST_PASSWORD,
        "role": "caregiver",
        "state_code": "GA",
        "first_name": "Jessica",
        "last_name": "Williams",
        "phone": "(555) 456-7890",
        "address": "300 Peachtree St, Atlanta, GA 30308",
        "dob": "1990-11-03",
        "ssn_last4": "2198",
    },
    {
        "email": "client.fl@caregiver.com",
        "password": TEST_PASSWORD,
        "role": "client",
        "state_code": "FL",
        "first_name": "Eleanor",
        "last_name": "Vance",
        "phone": "(555) 567-8901",
        "address": "450 Ocean Dr, Fort Lauderdale, FL 33301",
        "dob": "1948-02-18",
        "medicaid_number": "FL-MED-849201",
    },
    {
        "email": "client.in@caregiver.com",
        "password": TEST_PASSWORD,
        "role": "client",
        "state_code": "IN",
        "first_name": "Thomas",
        "last_name": "Sterling",
        "phone": "(555) 678-9012",
        "address": "520 Broad Ripple Ave, Indianapolis, IN 46220",
        "dob": "1952-07-14",
        "medicaid_number": "IN-MED-391048",
    },
]


def seed():
    sb = get_supabase()

    # Load lookup tables
    roles_res = sb.table("roles").select("id, name").execute()
    role_map = {r["name"]: r["id"] for r in roles_res.data}

    states_res = sb.table("states").select("id, code").execute()
    state_map = {s["code"]: s["id"] for s in states_res.data}

    print(f"Roles: {role_map}")
    print(f"States: {state_map}")

    # Fetch existing auth users to avoid duplicate creation errors
    existing_users = sb.auth.admin.list_users()
    existing_by_email = {u.email: u for u in existing_users}

    for acc in SEED_ACCOUNTS:
        email = acc["email"]
        role_id = role_map.get(acc["role"])
        state_id = state_map.get(acc["state_code"])

        # 1. Create or get Supabase Auth user
        if email in existing_by_email:
            user_id = str(existing_by_email[email].id)
            print(f"Auth user exists: {email} ({user_id})")
        else:
            try:
                created = sb.auth.admin.create_user({
                    "email": email,
                    "password": acc["password"],
                    "email_confirm": True,
                    "user_metadata": {
                        "first_name": acc["first_name"],
                        "last_name": acc["last_name"],
                    },
                })
                user_id = str(created.user.id)
                print(f"Created auth user: {email} ({user_id})")
            except Exception as e:
                print(f"Error creating auth user {email}: {e}")
                continue

        # 2. Upsert into public.users
        user_record = {
            "id": user_id,
            "email": email,
            "role_id": role_id,
            "state_id": state_id,
            "status": "active",
        }
        sb.table("users").upsert(user_record).execute()

        # 3. Create caregiver profile if role is caregiver
        if acc["role"] == "caregiver":
            cg_record = {
                "id": user_id,
                "state_id": state_id,
                "first_name": acc["first_name"],
                "last_name": acc["last_name"],
                "phone": acc.get("phone", ""),
                "address": acc.get("address", ""),
                "date_of_birth": acc.get("dob", "1990-01-01"),
                "ssn_last4": acc.get("ssn_last4", "1234"),
            }
            sb.table("caregivers").upsert(cg_record).execute()
            print(f"  -> Caregiver profile created for {email}")

        # 4. Create client profile if role is client
        if acc["role"] == "client":
            client_record = {
                "id": user_id,
                "state_id": state_id,
                "first_name": acc["first_name"],
                "last_name": acc["last_name"],
                "phone": acc.get("phone", ""),
                "address": acc.get("address", ""),
                "date_of_birth": acc.get("dob", "1950-01-01"),
                "medicaid_number": acc.get("medicaid_number", ""),
            }
            sb.table("clients").upsert(client_record).execute()
            print(f"  -> Client profile created for {email}")

    print("\nAll seed test accounts created successfully!")


if __name__ == "__main__":
    seed()
