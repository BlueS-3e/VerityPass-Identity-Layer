#!/usr/bin/env python3
"""
Safe one-off migration script to remove deprecated columns from the `project` table
and keep only the simplified project shape used by the frontend.

Usage:
  python3 migrate_projects_db.py

What it does:
  - Backs up `projects.db` to `projects.db.bak` in the same directory.
  - Creates a new table `project_new` with the simplified schema.
  - Copies id, project_name, contract_link, launch_date, description, status,
    wallet_address, whitepaper_filename from the old table when present.
  - Replaces the old table with the new one.

This script is safe to run multiple times (it will no-op if migration not needed).
"""

import sqlite3
import shutil
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), "projects.db")

if not os.path.exists(DB_PATH):
    print(f"No database found at {DB_PATH}; nothing to migrate.")
    sys.exit(0)

bak = DB_PATH + ".bak"
if not os.path.exists(bak):
    print(f"Backing up {DB_PATH} to {bak}")
    shutil.copy2(DB_PATH, bak)
else:
    print(f"Backup already present at {bak}")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

def table_columns(table):
    cur.execute("PRAGMA table_info('%s')" % table)
    return [r[1] for r in cur.fetchall()]

cols = table_columns('project')
print("Detected columns:", cols)

# If deprecated columns aren't present, nothing to do
deprecated = {'tokenomics', 'listing_fee', 'token_allocation', 'launch_fee'}
if not any(c in cols for c in deprecated):
    print("No deprecated columns found. Migration not required.")
    conn.close()
    sys.exit(0)

print("Creating new table 'project_new' with simplified schema...")
cur.execute('''
CREATE TABLE project_new (
  id INTEGER PRIMARY KEY,
  project_name TEXT,
  contract_link TEXT,
  launch_date TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending',
  wallet_address TEXT,
  whitepaper_filename TEXT
);
''')

print("Copying existing data (where available)...")
# Build select list defensively: use NULL for missing columns
select_cols = [
    'id',
    'project_name',
    'contract_link',
    'launch_date',
    'description',
    "COALESCE(status,'pending') as status",
    'wallet_address',
    'whitepaper_filename'
]

# Some older tables might not have all columns; wrap in COALESCE
available = set(cols)
sel = []
for c in ['id','project_name','contract_link','launch_date','description','status','wallet_address','whitepaper_filename']:
    if c in available:
        sel.append(c)
    else:
        sel.append('NULL as %s' % c)

sel_sql = ','.join(sel)
cur.execute(f"INSERT INTO project_new ({', '.join(['id','project_name','contract_link','launch_date','description','status','wallet_address','whitepaper_filename'])}) SELECT {sel_sql} FROM project;")
conn.commit()

print("Replacing old table with new table...")
cur.execute("DROP TABLE project;")
cur.execute("ALTER TABLE project_new RENAME TO project;")
conn.commit()
conn.close()

print("Migration complete. Original DB backed up to: ", bak)
