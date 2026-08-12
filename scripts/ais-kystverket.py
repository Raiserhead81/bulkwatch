#!/usr/bin/env python3
"""AIS Regional-Feed: Kystverket Norwegen — offizieller offener NMEA-TCP-Stream.
TCP 153.44.253.27:5631, keine Auth, NLOD-Lizenz (kommerziell erlaubt). Nur von
Server-IP erreichbar (nicht Residential). Sampelt den Stream SAMPLE_SEC Sekunden,
dekodiert mit pyais, upsertet Positionen per MMSI (Typ 1/2/3/18/19). Nur
bestehende Schiffe, keine Neuanlage. Abdeckung: norwegische Kueste 40-60nm.
Cron-tauglich: laeuft SAMPLE_SEC, dann Exit.
"""
import socket, sqlite3, time
from pyais import IterMessages

HOST = "153.44.253.27"; PORT = 5631
DB_PATH = "/opt/bulkwatch/db/ships.db"
SAMPLE_SEC = 45
POS_TYPES = {1, 2, 3, 18, 19}


def main():
    lines = []
    try:
        s = socket.create_connection((HOST, PORT), timeout=10)
        s.settimeout(5)
    except Exception as e:  # noqa: BLE001
        print(f"kystverket: Verbindung fehlgeschlagen: {e}"); return
    deadline = time.time() + SAMPLE_SEC
    buf = b""
    try:
        while time.time() < deadline:
            try:
                chunk = s.recv(4096)
            except socket.timeout:
                continue
            if not chunk:
                break
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                i = line.find(b"!")            # TAG-Block (\s:..\) abstreifen
                if i >= 0:
                    lines.append(line[i:].strip())
    finally:
        s.close()

    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA busy_timeout=10000")
    cur = conn.cursor()
    our = {str(r[0]) for r in cur.execute(
        "SELECT mmsi FROM ships WHERE mmsi IS NOT NULL AND mmsi<>''")}

    now = int(time.time())
    updated = set(); decoded = 0
    for msg in IterMessages(lines):
        try:
            d = msg.decode()
        except Exception:
            continue
        decoded += 1
        if getattr(d, "msg_type", None) not in POS_TYPES:
            continue
        mmsi = str(getattr(d, "mmsi", "") or "")
        lat = getattr(d, "lat", None); lon = getattr(d, "lon", None)
        if not mmsi or lat is None or lon is None:
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        if abs(lat - 91) < 0.001 or abs(lon - 181) < 0.001:   # AIS n/a
            continue
        if mmsi in our:
            cur.execute(
                "UPDATE ships SET lat=?, lon=?, last_seen=? "
                "WHERE mmsi=? AND (last_seen IS NULL OR last_seen < ?)",
                (lat, lon, now, mmsi, now))
            if cur.rowcount:
                updated.add(mmsi)

    conn.commit(); conn.close()
    print(f"{time.strftime('%F %T')} kystverket: {len(lines)} NMEA-Zeilen, "
          f"{decoded} dekodiert, {len(updated)} Flotte aktualisiert")


if __name__ == "__main__":
    main()
