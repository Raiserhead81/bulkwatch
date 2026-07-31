#!/usr/bin/env python3
import sqlite3, re, sys, time
DB="/opt/bulkwatch/db/ships.db"

def is_garbage(name):
    if not name: return False
    n = name
    if any(ord(c) < 32 for c in n): return True
    if any(c in '@#%' for c in n): return True
    if '\\' in n and not n.upper().startswith('M\\V'): return True
    s = n.strip()
    sym = sum(1 for c in s if not (c.isalnum() or c.isspace() or c in ".,-/&'()°"))
    if s.endswith(',') and sym >= 2: return True
    if s and sym/len(s) > 0.30: return True
    return False

def repair(name):
    out=[]
    for c in name:
        if c in '@#%\\' or ord(c) < 32: break
        out.append(c)
    s=''.join(out)
    s=re.sub(r'\s+',' ',s).strip().strip(",.-/_ ").strip()
    return s

conn=sqlite3.connect(DB); cur=conn.cursor()
rows=cur.execute("SELECT imo, name, coalesce(dwt,0), coalesce(year_built,0), coalesce(source,''), coalesce(type,'') FROM ships").fetchall()
delete_rows=[]; repair_rows=[]
for imo,name,dwt,yr,src,typ in rows:
    if not is_garbage(name): continue
    real = (dwt>0 or yr>0)
    if real:
        newn=repair(name)
        if len(newn)<2:
            newn=f"IMO {imo}"
        repair_rows.append((imo,name,newn))
    else:
        delete_rows.append((imo,name,dwt,yr,src))

apply = len(sys.argv)>1 and sys.argv[1]=='--apply'
print(f"=== GARBAGE-NAMEN: {len(delete_rows)+len(repair_rows)} betroffen ===")
print(f"\n--- ZUM LÖSCHEN (Geister, dwt=0 & year=0): {len(delete_rows)} ---")
for imo,name,dwt,yr,src in delete_rows:
    print(f"  DEL imo={imo:<12} src={src:<5} name={name!r}")
print(f"\n--- ZUM REPARIEREN (echte Schiffe mit dwt/year): {len(repair_rows)} ---")
for imo,old,new in repair_rows:
    print(f"  FIX imo={imo:<10} {old!r}  ->  {new!r}")

if apply:
    for imo,name,dwt,yr,src in delete_rows:
        cur.execute("DELETE FROM ships WHERE imo=?",(imo,))
    for imo,old,new in repair_rows:
        cur.execute("UPDATE ships SET name=? WHERE imo=?",(new,imo))
    conn.commit()
    print(f"\n*** APPLIED: {len(delete_rows)} gelöscht, {len(repair_rows)} repariert ***")
conn.close()
