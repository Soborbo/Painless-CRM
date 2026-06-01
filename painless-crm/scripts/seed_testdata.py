# Abundant test-data seeder for Painless CRM (remote Supabase via PostgREST).
# Every row carries the literal flag token "SEEDTEST" in a free-text field so the
# whole set can be removed later with a single `LIKE '%SEEDTEST%'` sweep.
# Inserts run with the service-role key (bypasses RLS), in FK dependency order,
# with client-generated UUIDs so children can reference parents without round-trips.
import json, urllib.request, urllib.error, uuid, random
from datetime import datetime, timedelta, timezone

random.seed(42)  # deterministic spread

# --- config from .env.local (no secrets on the command line) ---
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
USER = "48ce6fcd-7ccf-48b8-a0bf-43f29f52e320"
FLAG = "SEEDTEST"
NOTE = f"{FLAG} — test data, safe to delete"

NOW = datetime.now(timezone.utc)
def iso(dt): return dt.replace(microsecond=0).isoformat()
def days(n): return iso(NOW + timedelta(days=n))
def nid(): return str(uuid.uuid4())

def post(table, rows):
    if not rows:
        return
    # PostgREST bulk insert requires identical key sets across all objects.
    allkeys = set()
    for r in rows:
        allkeys.update(r.keys())
    rows = [{k: r.get(k) for k in allkeys} for r in rows]
    data = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(
        f"{URL}/rest/v1/{table}",
        data=data,
        method="POST",
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            print(f"  {table}: +{len(rows)} (HTTP {r.status})")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        print(f"!! {table} FAILED HTTP {e.code}: {body}")
        raise SystemExit(1)

# ---------------------------------------------------------------- addresses
streets = ["Gloucester Rd","Whiteladies Rd","North St","Church Rd","Coronation Rd",
           "Stapleton Rd","Bath Rd","Fishponds Rd","Wells Rd","Filton Ave",
           "Cheltenham Rd","St Michael's Hill","Park St","Victoria St","Temple Way",
           "Clarence Rd","Bedminster Pde","Henleaze Rd","Westbury Hill","Muller Rd",
           "Lawrence Hill","Kingsway","Sandy Park Rd","Two Mile Hill","Soundwell Rd"]
postcodes = ["BS7 8AE","BS8 2LG","BS3 1JP","BS5 9JA","BS3 1RP","BS5 0QY","BS4 3DW",
             "BS5 6PR","BS4 2AL","BS7 0LJ","BS6 5RR","BS2 8DT","BS1 5LJ","BS1 6AA",
             "BS2 0EZ","BS3 4DS","BS3 4HG","BS9 4JT","BS9 3AD","BS7 9RD","BS5 0DD",
             "BS2 0JP","BS4 3PE","BS15 1JA","BS16 4RP"]
addresses = []
for i in range(25):
    addresses.append({
        "id": nid(), "company_id": COMPANY,
        "line1": f"{random.randint(1,250)} {streets[i]}",
        "line2": FLAG,                       # <-- flag
        "city": "Bristol", "postcode": postcodes[i], "country": "GB",
    })
addr_ids = [a["id"] for a in addresses]
post("addresses", addresses)

# ---------------------------------------------------------------- customers
first = ["James","Olivia","Harry","Amelia","Jack","Isla","Charlie","Emily","Oscar",
         "Ava","George","Mia","Noah","Grace","Leo","Freya"]
last = ["Smith","Jones","Taylor","Brown","Williams","Wilson","Evans","Thomas",
        "Roberts","Walker","Wright","Hughes","Green","Hall","Wood","Clarke"]
companies = ["Westside Lettings Ltd","Harbour Estate Agents","Clifton Interiors",
             "BS Office Fit-Out Co","Greenway Property","Avon Relocations Ltd"]
sources = ["website","google_ads","meta_ads","referral","b2b_outreach","walk_in","phone"]
customers = []
for i in range(12):  # individuals
    customers.append({
        "id": nid(), "company_id": COMPANY, "customer_type": "individual",
        "first_name": first[i], "last_name": last[i],
        "primary_email": f"{first[i].lower()}.{last[i].lower()}@example.com",
        "primary_phone": f"07{random.randint(100,999)}{random.randint(100000,999999)}",
        "primary_address_id": addr_ids[i],
        "acquisition_source": random.choice(sources),
        "marketing_consent": random.choice([True, False]),
        "notes": NOTE, "created_by_id": USER,
    })
for i in range(6):  # businesses
    customers.append({
        "id": nid(), "company_id": COMPANY, "customer_type": "business",
        "company_name": companies[i], "vat_number": f"GB{random.randint(100000000,999999999)}",
        "payment_terms_days": random.choice([14, 30, 45]),
        "primary_email": f"accounts@{companies[i].split()[0].lower()}.example.com",
        "primary_phone": f"0117{random.randint(1000000,9999999)}",
        "primary_address_id": addr_ids[12 + i],
        "acquisition_source": "b2b_outreach",
        "notes": NOTE, "created_by_id": USER,
    })
cust_ids = [c["id"] for c in customers]
post("customers", customers)

# ---------------------------------------------------------------- pricing version (1)
pv_id = nid()
post("pricing_versions", [{
    "id": pv_id, "company_id": COMPANY, "version_label": f"{FLAG} default v1",
    "effective_from": days(-30),
    "margin_matrix": {"default": 0.35}, "crew_hourly_rate_pence": 2500,
    "van_hourly_rate_pence": 1800, "pass_through_config": {"fuel": True},
    "complications": {"stairs": 0.1}, "size_categories": {"studio": 1, "2bed": 2},
    "distance_bands": {"local": 0, "regional": 1}, "quote_validity_days": 7,
    "notes": NOTE, "created_by_id": USER,
}])

# ---------------------------------------------------------------- jobs (30)
stages = ["lead","contacted","survey_scheduled","quoted","accepted","confirmed",
          "in_progress","completed","invoiced","paid","declined","dead","cancelled"]
QUOTED_PLUS = {"quoted","accepted","confirmed","in_progress","completed","invoiced","paid"}
INVOICED_PLUS = {"invoiced","paid"}
COMPLETED_PLUS = {"completed","invoiced","paid"}
jobs = []
for i in range(30):
    stage = stages[i % len(stages)]
    cust = cust_ids[i % len(cust_ids)]
    total = random.randint(45000, 320000) if stage in QUOTED_PLUS else None
    jobs.append({
        "id": nid(), "company_id": COMPANY, "job_number": f"{FLAG}-{i+1:04d}",
        "customer_id": cust, "stage": stage,
        "acquisition_source": random.choice(sources),
        "assigned_to_id": USER,
        "enquiry_at": days(-random.randint(20, 90)),
        "move_date": days(random.randint(-30, 45)),
        "quote_total_pence": total,
        "notes": NOTE, "created_by_id": USER,
    })
job_ids = [j["id"] for j in jobs]
job_stage = {j["id"]: j["stage"] for j in jobs}
job_cust = {j["id"]: j["customer_id"] for j in jobs}
job_total = {j["id"]: j["quote_total_pence"] for j in jobs}
post("jobs", jobs)

# ---------------------------------------------------------------- job_addresses (from/to)
ja = []
for i, jid in enumerate(job_ids):
    a_from = addr_ids[i % len(addr_ids)]
    a_to = addr_ids[(i + 7) % len(addr_ids)]
    ja.append({"id": nid(), "company_id": COMPANY, "job_id": jid,
               "address_id": a_from, "role": "from", "sequence": 0,
               "property_type": random.choice(["house","flat","bungalow"]),
               "floor": random.randint(0, 4), "access_notes": FLAG})
    ja.append({"id": nid(), "company_id": COMPANY, "job_id": jid,
               "address_id": a_to, "role": "to", "sequence": 1,
               "property_type": random.choice(["house","flat","bungalow"]),
               "floor": random.randint(0, 4), "access_notes": FLAG})
post("job_addresses", ja)

# ---------------------------------------------------------------- job_tags
tags = []
for jid in job_ids:
    for t in random.sample(["seedtest","fragile","piano","long-carry","weekend"], k=2):
        tags.append({"id": nid(), "company_id": COMPANY, "job_id": jid,
                     "tag": t, "added_by_id": USER})
# dedupe (job_id, tag)
seen = set(); tags = [t for t in tags if (t["job_id"], t["tag"]) not in seen and not seen.add((t["job_id"], t["tag"]))]
post("job_tags", tags)

# ---------------------------------------------------------------- quotes
quotes = []
quote_for = {}
for jid in job_ids:
    if job_stage[jid] in QUOTED_PLUS:
        qid = nid(); quote_for[jid] = qid
        total = job_total[jid] or random.randint(45000, 320000)
        st = "accepted" if job_stage[jid] in {"accepted","confirmed","in_progress","completed","invoiced","paid"} else "sent"
        quotes.append({
            "id": qid, "company_id": COMPANY, "job_id": jid,
            "pricing_version_id": pv_id, "pricing_snapshot": {"seed": True, "flag": FLAG},
            "size_code": random.choice(["studio","2bed","3bed"]),
            "distance_miles": random.randint(3, 80),
            "total_pence": total, "breakdown": {"labour": int(total*0.6), "van": int(total*0.4)},
            "status": st, "valid_until": days(7), "sent_at": days(-random.randint(1, 15)),
            "notes": NOTE, "created_by_id": USER,
        })
post("quotes", quotes)

# ---------------------------------------------------------------- invoices + lines
invoices = []; inv_lines = []; inv_meta = {}
inv_n = 0
for jid in job_ids:
    if job_stage[jid] in INVOICED_PLUS:
        inv_n += 1
        iid = nid()
        subtotal = job_total[jid] or random.randint(45000, 300000)
        vat = int(subtotal * 0.20)
        total = subtotal + vat
        paid_stage = job_stage[jid] == "paid"
        status = "paid" if paid_stage else random.choice(["sent","partial","overdue"])
        amount_paid = total if status == "paid" else (int(total*0.5) if status == "partial" else 0)
        inv_meta[iid] = {"customer": job_cust[jid], "total": total, "paid": amount_paid, "status": status}
        invoices.append({
            "id": iid, "company_id": COMPANY, "job_id": jid, "customer_id": job_cust[jid],
            "invoice_number": f"{FLAG}-INV-{inv_n:04d}", "type": random.choice(["deposit","final","custom"]),
            "status": status, "subtotal_pence": subtotal, "vat_pence": vat, "total_pence": total,
            "amount_paid_pence": amount_paid, "issued_at": days(-random.randint(2, 20)),
            "due_at": days(random.randint(-10, 14)), "created_by_id": USER,
        })
        inv_lines.append({"id": nid(), "company_id": COMPANY, "invoice_id": iid,
                          "description": f"Removal service — labour & van [{FLAG}]",
                          "quantity": 1, "unit_price_pence": int(subtotal*0.7),
                          "vat_rate": 20.00, "line_total_pence": int(subtotal*0.7), "sort_order": 0})
        inv_lines.append({"id": nid(), "company_id": COMPANY, "invoice_id": iid,
                          "description": f"Packing materials [{FLAG}]",
                          "quantity": 2, "unit_price_pence": int(subtotal*0.15),
                          "vat_rate": 20.00, "line_total_pence": int(subtotal*0.3), "sort_order": 1})
post("invoices", invoices)
post("invoice_lines", inv_lines)

# ---------------------------------------------------------------- payments + allocations
payments = []; allocations = []; pay_n = 0
for iid, m in inv_meta.items():
    if m["paid"] > 0:
        pay_n += 1
        pid = nid()
        payments.append({
            "id": pid, "company_id": COMPANY, "customer_id": m["customer"],
            "amount_pence": m["paid"], "method": random.choice(["bank_transfer","card","cash"]),
            "occurred_at": days(-random.randint(1, 12)), "reference": f"{FLAG}-PAY-{pay_n:04d}",
            "source": "manual", "notes": NOTE, "created_by_id": USER,
        })
        allocations.append({
            "id": nid(), "company_id": COMPANY, "payment_id": pid, "invoice_id": iid,
            "allocation_type": "payment_to_invoice", "amount_pence": m["paid"],
            "allocated_by_id": USER, "notes": FLAG,
        })
post("payments", payments)
post("payment_allocations", allocations)

# ---------------------------------------------------------------- vehicles (6)
vtypes = ["luton","transit","7.5t","18t","trailer","car"]
vehicles = []
for i in range(6):
    vehicles.append({
        "id": nid(), "company_id": COMPANY, "registration": f"{FLAG}-{i+1:02d}",
        "type": vtypes[i], "capacity_cubic_ft": random.choice([800,1200,1600,400,200,60]),
        "monthly_cost_pence": random.randint(20000, 90000), "active": True,
        "mot_due": days(random.randint(20, 300)), "tax_due": days(random.randint(20, 300)),
        "insurance_due": days(random.randint(20, 300)), "next_service_due": days(random.randint(10, 120)),
    })
post("vehicles", vehicles)

# ---------------------------------------------------------------- workers (6)
wnames = ["Dave Mills","Tom Hartley","Ryan Cole","Steve Ward","Luke Perry","Marcus Bell"]
workers = []
for i in range(6):
    workers.append({
        "id": nid(), "company_id": COMPANY, "full_name": wnames[i],
        "phone": f"07{random.randint(100,999)}{random.randint(100000,999999)}",
        "email": f"{wnames[i].split()[0].lower()}@crew.example.com",
        "hourly_rate_pence": random.randint(1300, 2200), "active": True, "notes": NOTE,
    })
post("workers", workers)

# ---------------------------------------------------------------- surveys
surveys = []
for jid in job_ids:
    if job_stage[jid] in {"survey_scheduled","quoted","accepted","confirmed","in_progress","completed","invoiced","paid"} and random.random() < 0.5:
        surveys.append({
            "id": nid(), "company_id": COMPANY, "job_id": jid, "surveyor_id": USER,
            "survey_type": random.choice(["video_self","video_live","in_person","estimate_only"]),
            "scheduled_at": days(-random.randint(5, 25)), "completed_at": days(-random.randint(1, 5)),
            "cubic_ft_estimate": random.randint(200, 1500),
            "cubic_ft_confidence": random.choice(["low","medium","high"]),
            "notes_internal": NOTE,
        })
post("surveys", surveys)

# ---------------------------------------------------------------- complaints
complaints = []
for jid in [j for j in job_ids if job_stage[j] in COMPLETED_PLUS][:6]:
    complaints.append({
        "id": nid(), "company_id": COMPANY, "job_id": jid, "customer_id": job_cust[jid],
        "source": random.choice(["email","phone","signoff_passive","other"]),
        "description": f"{FLAG}: customer reported a minor scuff on a wardrobe.",
        "severity": random.choice(["low","medium","high"]),
        "status": random.choice(["new","investigating","resolved"]),
        "assigned_to_id": USER,
    })
post("complaints", complaints)

# ---------------------------------------------------------------- damage_claims
damages = []
for jid in [j for j in job_ids if job_stage[j] in COMPLETED_PLUS][:5]:
    damages.append({
        "id": nid(), "company_id": COMPANY, "job_id": jid,
        "description": f"{FLAG}: dining table leg chipped during transit.",
        "estimated_value_pence": random.randint(5000, 40000),
        "status": random.choice(["reported","investigating","agreed","paid"]),
    })
post("damage_claims", damages)

# ---------------------------------------------------------------- notes
ns = []
for jid in job_ids[:12]:
    ns.append({"id": nid(), "company_id": COMPANY, "parent_type": "job", "parent_id": jid,
               "category": "admin", "body": f"{FLAG}: follow up with customer re: parking permit.",
               "created_by_id": USER})
for cid in cust_ids[:8]:
    ns.append({"id": nid(), "company_id": COMPANY, "parent_type": "customer", "parent_id": cid,
               "category": "staff", "body": f"{FLAG}: prefers contact by WhatsApp.",
               "created_by_id": USER})
post("notes", ns)

# ---------------------------------------------------------------- messages
msgs = []
for i, jid in enumerate(job_ids[:12]):
    msgs.append({"id": nid(), "company_id": COMPANY, "customer_id": job_cust[jid], "job_id": jid,
                 "channel": random.choice(["email","sms","whatsapp"]),
                 "direction": random.choice(["outbound","inbound"]),
                 "subject": f"Your move — {FLAG}",
                 "body": f"{FLAG}: confirming your booking details. Reply to confirm.",
                 "status": "sent"})
post("messages", msgs)

# ---------------------------------------------------------------- phone_calls
calls = []
for jid in job_ids[:8]:
    calls.append({"id": nid(), "company_id": COMPANY, "customer_id": job_cust[jid], "job_id": jid,
                  "direction": random.choice(["inbound","outbound"]),
                  "caller_number": "07700900000", "called_number": "01170000000",
                  "duration_seconds": random.randint(40, 600), "user_id": USER,
                  "notes": NOTE, "source": "manual", "occurred_at": days(-random.randint(1, 20))})
post("phone_calls", calls)

# ---------------------------------------------------------------- templates
post("email_templates", [
    {"id": nid(), "company_id": COMPANY, "name": f"{FLAG} Quote follow-up", "category": "sales",
     "subject_template": "Your removal quote", "body_template": f"{FLAG} Hi {{first_name}}, here is your quote.", "created_by_id": USER},
    {"id": nid(), "company_id": COMPANY, "name": f"{FLAG} Booking confirmation", "category": "ops",
     "subject_template": "Booking confirmed", "body_template": f"{FLAG} Your move is booked for {{move_date}}.", "created_by_id": USER},
    {"id": nid(), "company_id": COMPANY, "name": f"{FLAG} Invoice reminder", "category": "finance",
     "subject_template": "Invoice due", "body_template": f"{FLAG} A friendly reminder that invoice {{invoice_number}} is due.", "created_by_id": USER},
])
post("sms_templates", [
    {"id": nid(), "company_id": COMPANY, "name": f"{FLAG} On the way", "body_template": f"{FLAG} Your crew is en route, ETA 30 min."},
    {"id": nid(), "company_id": COMPANY, "name": f"{FLAG} Review ask", "body_template": f"{FLAG} Thanks! Mind leaving us a review?"},
])

print("\nDONE. All rows flagged with token:", FLAG)
