# Entwicklungs- und Produktionsbetrieb für Gaderobe

## Entwicklung

1. **Systemd-Services deaktivieren**
   - Bereits erledigt: Die systemd-Services für Backend und Frontend sind deaktiviert und starten nach einem Reboot nicht mehr automatisch.

2. **Nginx bleibt aktiv**
   - Nginx läuft weiterhin als Reverse Proxy für HTTPS (Ports 443/3078).

3. **Backend und Frontend im Entwicklungsmodus starten**
   - Öffne zwei Terminals:
     - **Backend:**
       ```bash
       cd ~/Gaderobe/backend
       npm run dev
       ```
     - **Frontend:**
       ```bash
       cd ~/Gaderobe/frontend
       npm run dev
       ```
   - Hot-Reload ist aktiv, Änderungen werden sofort übernommen.

---

## Umstellung auf Produktionsmodus (automatischer Start)

1. **Systemd-Services wieder aktivieren:**
   ```bash
   sudo systemctl enable gaderobe-backend
   sudo systemctl enable gaderobe-frontend
   sudo systemctl start gaderobe-backend
   sudo systemctl start gaderobe-frontend
   ```
   - Nach einem Reboot starten Backend und Frontend automatisch im Produktionsmodus.

2. **Nginx bleibt unverändert aktiv**
   - HTTPS-Proxy bleibt bestehen.

---

## Zusammenfassung
- **Entwicklung:** systemd-Services deaktiviert, manuelles Starten im dev-Modus, Hot-Reload.
- **Produktion:** systemd-Services aktivieren, automatischer Start nach Reboot, Nginx als HTTPS-Proxy.

> Diese Datei kann bei Bedarf angepasst und im Projekt (z.B. als `DEVELOPMENT.md` oder im `README.md`) abgelegt werden.