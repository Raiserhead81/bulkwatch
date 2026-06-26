#!/usr/bin/env bash
# =============================================================================
# SnapGuide AI — Deployment-Skript für Gemivo-Server
# Ziel:        travelguide.gemivo.de
# App-Pfad:    /opt/travelguide
# Service:     travelguide.service
# Port:        3092
#
# Aufruf:      sudo bash /tmp/deploy-travelguide.sh
# Voraussetzung: travelguide-update.tar.gz liegt in /tmp/
# =============================================================================
set -euo pipefail

APP_NAME="travelguide"
APP_DIR="/opt/${APP_NAME}"
SERVICE_NAME="${APP_NAME}.service"
TARBALL="/tmp/travelguide-update.tar.gz"
PORT=3092

echo "================================================"
echo " SnapGuide AI — Deployment auf Gemivo-Server"
echo " Pfad:    ${APP_DIR}"
echo " Port:    ${PORT}"
echo " Service: ${SERVICE_NAME}"
echo "================================================"

# ---- 0. Preflight checks -----------------------------------------------------
if [[ ! -f "${TARBALL}" ]]; then
  echo "FEHLER: ${TARBALL} nicht gefunden."
  echo "Bitte lade travelguide-update.tar.gz nach /tmp/ hoch."
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "FEHLER: bun ist nicht installiert."
  echo "Installieren mit: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

echo
echo "[1/8] Service stoppen (falls vorhanden)..."
systemctl stop "${APP_NAME}" 2>/dev/null || true

echo "[2/8] Backup vorhandener Konfiguration..."
BACKUP_DIR="/opt/${APP_NAME}.backup.$(date +%Y%m%d-%H%M%S)"
if [[ -d "${APP_DIR}" ]]; then
  mkdir -p "${BACKUP_DIR}"
  # Wichtige Configs sichern (NICHT node_modules oder .next)
  for f in .env.production .z-ai-config; do
    if [[ -f "${APP_DIR}/${f}" ]]; then
      cp "${APP_DIR}/${f}" "${BACKUP_DIR}/${f}"
      echo "  → gesichert: ${f}"
    fi
  done
fi

echo "[3/8] App-Verzeichnis vorbereiten..."
mkdir -p "${APP_DIR}"
# Alle bisherigen Dateien entfernen (Configs sind gesichert)
find "${APP_DIR}" -mindepth 1 -delete 2>/dev/null || true

echo "[4/8] Tarball entpacken..."
tar -xzf "${TARBALL}" -C "${APP_DIR}"
echo "  → entpackt nach ${APP_DIR}"

echo "[5/8] Konfiguration wiederherstellen (falls Backup existiert)..."
if [[ -n "${BACKUP_DIR:-}" && -d "${BACKUP_DIR}" ]]; then
  for f in .env.production .z-ai-config; do
    if [[ -f "${BACKUP_DIR}/${f}" && ! -f "${APP_DIR}/${f}" ]]; then
      cp "${BACKUP_DIR}/${f}" "${APP_DIR}/${f}"
      echo "  → wiederhergestellt: ${f}"
    fi
  done
fi

# Wenn keine Config vorhanden ist, Beispiele kopieren
if [[ ! -f "${APP_DIR}/.env.production" ]]; then
  if [[ -f "${APP_DIR}/deploy/.env.production.example" ]]; then
    cp "${APP_DIR}/deploy/.env.production.example" "${APP_DIR}/.env.production"
    echo "  ⚠ .env.production fehlt — Beispiel kopiert. Bitte anpassen!"
  fi
fi
if [[ ! -f "${APP_DIR}/.z-ai-config" ]]; then
  if [[ -f "${APP_DIR}/deploy/.z-ai-config.example" ]]; then
    cp "${APP_DIR}/deploy/.z-ai-config.example" "${APP_DIR}/.z-ai-config"
    echo "  ⚠ .z-ai-config fehlt — Beispiel kopiert. BITTE API-KEY EINTRAGEN!"
  fi
fi

echo "[6/8] Dependencies installieren..."
cd "${APP_DIR}"
bun install --frozen-lockfile 2>/dev/null || bun install

echo "[7/8] Production Build erstellen..."
bun run build

echo "[8/8] systemd-Service installieren und starten..."
# Service-Datei kopieren (falls im Tarball enthalten)
if [[ -f "${APP_DIR}/deploy/travelguide.service" ]]; then
  cp "${APP_DIR}/deploy/travelguide.service" "/etc/systemd/system/${SERVICE_NAME}"
fi
systemctl daemon-reload
systemctl enable "${APP_NAME}"
systemctl start "${APP_NAME}"

# Kurz warten und Status prüfen
sleep 3
echo
echo "------------------------------------------------"
echo " Service-Status:"
systemctl --no-pager status "${APP_NAME}" || true
echo "------------------------------------------------"
echo
echo "Port prüfen:"
ss -tlnp | grep ":${PORT}" || echo "  (Port ${PORT} noch nicht aktiv — Service-Log prüfen)"

echo
echo "================================================"
echo " Deployment abgeschlossen!"
echo " Teste:  curl -I http://127.0.0.1:${PORT}/"
echo " Logs:   journalctl -u ${APP_NAME} -f"
echo ""
echo " Nginx nicht vergessen:"
echo "   cp ${APP_DIR}/deploy/travelguide.gemivo.de.conf /etc/nginx/sites-available/"
echo "   ln -sf /etc/nginx/sites-available/travelguide.gemivo.de.conf /etc/nginx/sites-enabled/"
echo "   nginx -t && systemctl reload nginx"
echo "================================================"
