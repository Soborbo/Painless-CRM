#!/usr/bin/env python3
"""Generate staging SQL for the Painless CRM iMVE import.
Outputs chunked INSERT files into /tmp/import/sql/ plus a manifest.
All transformation (dedup, stage mapping, line parsing) is done here in Python;
the DB transform (10_transform.sql, written separately) is pure set-based SQL."""
import csv, re, os, json
from collections import defaultdict, Counter

SRC = "/tmp/import"
OUT = "/tmp/import/sql"
os.makedirs(OUT, exist_ok=True)

def load(f):
    with open(os.path.join(SRC, f), encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))

jobs = load("jobs.csv"); deps = load("deposits.csv")
invs = load("invoices.csv"); cust = load("custom.csv")

# ---------- helpers ----------
def sq(v):
    "SQL-quote a value or NULL (whitespace flattened so each chunk stays one line)"
    if v is None:
        return "NULL"
    s = re.sub(r"\s+", " ", str(v)).strip()
    return "'" + s.replace("'", "''") + "'"

def money_p(s):
    "money string -> integer pence"
    if s is None: return 0
    s = str(s).strip().replace(",", "").replace("£", "")
    if not s: return 0
    try: return int(round(float(s) * 100))
    except ValueError: return 0

def to_date(s):
    "DD-MM-YYYY or YYYY-MM-DD[THH..] -> YYYY-MM-DD (or None)"
    if not s: return None
    s = s.strip()
    if not s: return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m: return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\d{2})-(\d{2})-(\d{4})$", s)
    if m: return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return None

def norm_phone(p): return re.sub(r"\D", "", p or "")
def norm_email(e): return (e or "").strip().lower()

def split_name(n):
    n = (n or "").strip()
    if not n: return (None, None)
    parts = n.split()
    if len(parts) == 1: return (parts[0], None)
    return (parts[0], " ".join(parts[1:]))

# ---------- stage mapping ----------
STAGE = {
    'New Enquiry 1':'lead','New Enquiry 2':'lead','New Enquiry 3':'lead',
    'Website enquiry':'lead','Telephone enquiry':'lead','To call':'lead',
    'Hot \U0001f525\U0001f525\U0001f525':'contacted','Warm \U0001f525\U0001f525':'contacted','Cold \U0001f525':'contacted',
    'Survey Booked':'survey_scheduled','Awaiting video':'survey_scheduled',
    'Self survey sent':'survey_scheduled','Survey Requested':'survey_scheduled',
    'Quoted':'quoted','Quoted 1':'quoted','Quoted 2':'quoted',
    'Speculative Quote':'quoted','Undecided':'quoted',
    'Accepted':'accepted','Postponed':'accepted',
    'Confirmed':'confirmed','Provisional':'confirmed','Move Date':'confirmed',
    'Completed':'completed',
    'Awaiting payment':'invoiced',
    'Paid in full':'paid',
    'Declined':'declined','Declined - Competitor':'declined',
    'Declined - Too expensive':'declined','Declined - Lost no response':'dead',
    'Declined - Didn’t move':'declined','Declined - Can’t do move date':'declined',
    'Date not available':'declined',
    'No Response \U0001f480':'dead','Dead Lead':'dead',
}
# iMVE decline label -> canonical decline_reason (MIGRATION_MAPPING.md §3)
DREASON = {
    'Declined - Competitor':'chose_competitor',
    'Declined - Too expensive':'too_expensive',
    'Declined - Can’t do move date':'timing',
    'Declined - Didn’t move':'didnt_move',
    'Date not available':'date_unavailable',
    'Declined':'other',
}
def stage_for(status):
    return STAGE.get((status or "").strip(), 'lead')
def dreason_for(status):
    return DREASON.get((status or "").strip())

# ---------- skip test rows ----------
SKIP = {'1888','1867','1782','1587','1534','1338','75','44','33'}

# ---------- dedup jobs to one row per job_number ----------
by_num = {}
order = []
for j in jobs:
    n = j['Job Number'].strip()
    if n in SKIP: continue
    if n not in by_num:
        by_num[n] = j
        order.append(n)
# (duplicate rows are identical on stable fields; keep first)

# ---------- build customer keys ----------
def cust_key(j):
    e = norm_email(j['Email']); p = norm_phone(j['Phone']); n = j['Client Name'].strip().lower()
    if e: return e
    if p: return 'p:' + p
    return 'n:' + n

# ---------- stg.jobs rows ----------
stg_jobs = []
for n in order:
    j = by_num[n]
    fn, ln = split_name(j['Client Name'])
    status_raw = j['Job Status'].strip()
    jobname = j['Job Name'].strip()
    # only keep legacy_name when it adds info beyond the client name
    legacy = jobname if jobname and jobname.lower() != (j['Client Name'].strip().lower()) else None
    ms = to_date(j['Job Move Start Date']); me = to_date(j['Job Move End Date'])
    stg_jobs.append({
        'job_number': n,
        'first_name': fn, 'last_name': ln,
        'email': norm_email(j['Email']) or None,
        'phone': j['Phone'].strip() or None,
        'cust_key': cust_key(j),
        'legacy_name': legacy,
        'source': j['Job Source'].strip() or None,
        'status_raw': status_raw or None,
        'stage': stage_for(status_raw),
        'decline_reason': dreason_for(status_raw),
        'created_date': to_date(j['Job Creation Date']),
        'move_start': ms,
        'move_end': me,
        'from_pc': j['Job Move From Postcode'].strip() or None,
        'to_pc': j['Job Move To Postcode'].strip() or None,
    })

# ---------- invoices: detail (with line items) ----------
def parse_lines(s):
    out = []
    s = (s or "").strip()
    if not s: return out
    for part in s.split('|'):
        part = part.strip()
        if not part: continue
        m = re.match(r'^(.*):\s*(-?[\d,]+\.?\d*)\s*$', part)
        if m:
            out.append((m.group(1).strip(), money_p(m.group(2))))
        else:
            out.append((part, None))  # amount unknown
    return out

stg_inv = {}     # invoice_number -> dict
stg_lines = []   # (invoice_number, desc, unit_p, sort)

def add_detail(rows, kind):
    for r in rows:
        num = r['Invoice Number'].strip()
        ref = r['Job Reference'].strip()
        if ref in SKIP: continue
        if not num:
            num = f"DEP-{ref}-{kind[:1].upper()}-{len(stg_inv)}"  # synthesise for blank deposit numbers
        if num in stg_inv:   # duplicate invoice number across files -> keep first
            continue
        subtotal = money_p(r.get('Subtotal') or r.get('Deposit Amount'))
        vat = money_p(r.get('VAT Amount'))
        total = money_p(r.get('Total'))
        if kind == 'deposit':
            subtotal = money_p(r.get('Deposit Amount'))
        stg_inv[num] = {
            'invoice_number': num, 'kind': kind, 'status_raw': r['Status'].strip(),
            'issue_date': to_date(r.get('Issue Date') or r.get('Created Date')),
            'due_date': to_date(r.get('Due Date')),
            'created_date': to_date(r.get('Created Date')),
            'job_ref': ref, 'subtotal_p': subtotal, 'vat_p': vat, 'total_p': total,
        }
        # line items
        if kind == 'deposit':
            stg_lines.append((num, 'Booking deposit', subtotal, 0))
        else:
            items = parse_lines(r.get('Line Items'))
            if not items or all(a is None for _, a in items):
                stg_lines.append((num, (r.get('Line Items') or 'Removal service').strip()[:500], subtotal, 0))
            else:
                for i, (d, a) in enumerate(items):
                    stg_lines.append((num, d[:500], a if a is not None else 0, i))

add_detail(deps, 'deposit')
add_detail(invs, 'final')
add_detail(cust, 'custom')

# ---------- invoices: inline-only (summary, no line detail) ----------
detail_nums = set(stg_inv.keys())
inline_added = 0
for n in order:
    j = by_num[n]
    # final invoice
    inv_num = j['Invoice Number'].strip()
    if inv_num and inv_num not in detail_nums and inv_num not in stg_inv:
        total = money_p(j['Total Amount']); vat = money_p(j['VAT Amount'])
        sub = money_p(j['Invoice Amount'])
        if total == 0 and sub == 0:
            pass
        else:
            st = 'Paid' if j['Invoice Status'].strip().lower() == 'paid' else 'Unpaid'
            stg_inv[inv_num] = {'invoice_number': inv_num, 'kind': 'final', 'status_raw': st,
                'issue_date': to_date(j['Job Creation Date']), 'due_date': None,
                'created_date': to_date(j['Job Creation Date']), 'job_ref': n,
                'subtotal_p': sub if sub else total - vat, 'vat_p': vat, 'total_p': total}
            stg_lines.append((inv_num, 'Removal service (summary — migrated from iMVE)', sub if sub else total - vat, 0))
            inline_added += 1
    # deposit invoice
    dep_num = j['Deposit Invoice Number'].strip()
    if dep_num and dep_num not in detail_nums and dep_num not in stg_inv:
        damt = money_p(j['Deposit Amount'])
        if damt > 0:
            st = 'Paid' if j['Deposit Status'].strip().lower() == 'paid' else 'Unpaid'
            vat = int(round(damt * 0.20))
            stg_inv[dep_num] = {'invoice_number': dep_num, 'kind': 'deposit', 'status_raw': st,
                'issue_date': to_date(j['Job Creation Date']), 'due_date': None,
                'created_date': to_date(j['Job Creation Date']), 'job_ref': n,
                'subtotal_p': damt, 'vat_p': vat, 'total_p': damt + vat}
            stg_lines.append((dep_num, 'Booking deposit (summary — migrated from iMVE)', damt, 0))
            inline_added += 1

# ---------- emit SQL ----------
def chunked_insert(fname, table, cols, rows, rowfn, chunk=500):
    paths = []
    header = f"insert into {table} ({', '.join(cols)}) values "
    n = 0
    i = 0
    while i < len(rows):
        n += 1
        buf = []
        size = len(header)
        while i < len(rows):
            v = rowfn(rows[i])
            if buf and size + len(v) + 1 > 24000:
                break
            buf.append(v); size += len(v) + 1; i += 1
        p = os.path.join(OUT, f"{fname}_{n:02d}.sql")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(header + ",".join(buf) + ";")
        paths.append(p)
    return paths

manifest = {}

manifest['stg_jobs'] = chunked_insert(
    "01_stg_jobs", "stg.jobs",
    ['job_number','first_name','last_name','email','phone','cust_key','legacy_name',
     'source','status_raw','stage','decline_reason','created_date','move_start','move_end','from_pc','to_pc'],
    stg_jobs,
    lambda r: "(" + ",".join([
        sq(r['job_number']), sq(r['first_name']), sq(r['last_name']), sq(r['email']),
        sq(r['phone']), sq(r['cust_key']), sq(r['legacy_name']), sq(r['source']),
        sq(r['status_raw']), sq(r['stage']), sq(r['decline_reason']),
        ("NULL" if not r['created_date'] else sq(r['created_date'])),
        ("NULL" if not r['move_start'] else sq(r['move_start'])),
        ("NULL" if not r['move_end'] else sq(r['move_end'])),
        sq(r['from_pc']), sq(r['to_pc'])]) + ")")

inv_rows = list(stg_inv.values())
manifest['stg_invoices'] = chunked_insert(
    "02_stg_invoices", "stg.invoices",
    ['invoice_number','kind','status_raw','issue_date','due_date','created_date',
     'job_ref','subtotal_p','vat_p','total_p'],
    inv_rows,
    lambda r: "(" + ",".join([
        sq(r['invoice_number']), sq(r['kind']), sq(r['status_raw']),
        ("NULL" if not r['issue_date'] else sq(r['issue_date'])),
        ("NULL" if not r['due_date'] else sq(r['due_date'])),
        ("NULL" if not r['created_date'] else sq(r['created_date'])),
        sq(r['job_ref']), str(r['subtotal_p']), str(r['vat_p']), str(r['total_p'])]) + ")")

manifest['stg_invoice_lines'] = chunked_insert(
    "03_stg_invoice_lines", "stg.invoice_lines",
    ['invoice_number','description','unit_p','sort'],
    stg_lines,
    lambda r: "(" + ",".join([sq(r[0]), sq(r[1]), str(r[2]), str(r[3])]) + ")")

with open(os.path.join(OUT, "manifest.json"), "w") as fh:
    json.dump({k: [os.path.basename(p) for p in v] for k, v in manifest.items()}, fh, indent=2)

# ---------- summary ----------
print("=== GENERATION SUMMARY ===")
print("unique jobs (after skip):", len(stg_jobs))
print("distinct customer keys  :", len(set(r['cust_key'] for r in stg_jobs)))
pcs = set(r['from_pc'] for r in stg_jobs if r['from_pc']) | set(r['to_pc'] for r in stg_jobs if r['to_pc'])
print("distinct postcodes      :", len(pcs))
print("invoices total          :", len(inv_rows), "(detail+inline; inline-only added:", inline_added, ")")
print("  by kind:", dict(Counter(r['kind'] for r in inv_rows)))
print("  by status:", dict(Counter(r['status_raw'] for r in inv_rows)))
print("invoice lines           :", len(stg_lines))
paid = [r for r in inv_rows if r['status_raw'].lower() == 'paid']
print("paid invoices -> payments:", len(paid))
print("stage distribution      :", dict(Counter(r['stage'] for r in stg_jobs)))
print("legacy_name present     :", sum(1 for r in stg_jobs if r['legacy_name']))
print("move_end present         :", sum(1 for r in stg_jobs if r['move_end']))
print("\nchunk files:")
for k, v in manifest.items():
    tot = sum(os.path.getsize(p) for p in v)
    print(f"  {k}: {len(v)} files, {tot//1024} KB")
