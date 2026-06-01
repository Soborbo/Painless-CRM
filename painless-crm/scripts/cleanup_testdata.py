# Removes everything created by seed_testdata.py.
# Deletes in reverse FK order, filtered on the "SEEDTEST" flag token.
# Run: python scripts/cleanup_testdata.py
import urllib.request, urllib.error

ENV = {}
with open(".env.local", encoding="utf-8") as fh:
    for line in fh:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            ENV[k.strip()] = v.strip()

URL = ENV["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = ENV["SUPABASE_SERVICE_ROLE_KEY"]
COMPANY = "00000000-0000-0000-0000-000000000001"

def delete(table, query):
    req = urllib.request.Request(
        f"{URL}/rest/v1/{table}?{query}",
        method="DELETE",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Prefer": "return=minimal"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            print(f"  {table}: deleted (HTTP {r.status})")
    except urllib.error.HTTPError as e:
        print(f"!! {table} HTTP {e.code}: {e.read().decode('utf-8','replace')}")

# Reverse dependency order. invoice_lines & job_addresses cascade from their parents
# but are deleted explicitly first to be safe; payment_allocations must precede payments.
delete("payment_allocations", "notes=eq.SEEDTEST")
delete("payments", "notes=like.*SEEDTEST*")
delete("invoice_lines", "description=like.*SEEDTEST*")
delete("invoices", "invoice_number=like.SEEDTEST*")
delete("quotes", "notes=like.*SEEDTEST*")
delete("surveys", "notes_internal=like.*SEEDTEST*")
delete("complaints", "description=like.*SEEDTEST*")
delete("damage_claims", "description=like.*SEEDTEST*")
delete("notes", "body=like.*SEEDTEST*")
delete("messages", "body=like.*SEEDTEST*")
delete("phone_calls", "notes=like.*SEEDTEST*")
delete("job_tags", f"company_id=eq.{COMPANY}")
delete("job_addresses", "access_notes=eq.SEEDTEST")
delete("jobs", "job_number=like.SEEDTEST*")
delete("pricing_versions", "version_label=like.*SEEDTEST*")
delete("customers", "notes=like.*SEEDTEST*")
delete("addresses", "line2=eq.SEEDTEST")
delete("vehicles", "registration=like.SEEDTEST*")
delete("workers", "notes=like.*SEEDTEST*")
delete("email_templates", "name=like.SEEDTEST*")
delete("sms_templates", "name=like.SEEDTEST*")
print("\nCleanup complete. (activity_log audit rows from the seed remain; clear by company if needed.)")
