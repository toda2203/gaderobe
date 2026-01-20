# 📘 Bekleidungsverwaltung - Setup & Deployment Guide

## 🚀 Schnellstart

### Voraussetzungen
- **Docker** & **Docker Compose** installiert
- **Microsoft Entra ID** (Azure AD) Zugang
- **Git** (optional)

### 1️⃣ Projekt einrichten

```powershell
# Repository klonen oder entpacken
cd C:\path\to\bekleidung

# Environment-Dateien erstellen
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

### 2️⃣ Microsoft Entra ID konfigurieren

#### App Registration erstellen
1. Gehe zu [Azure Portal](https://portal.azure.com)
2. **Azure Active Directory** → **App registrations** → **New registration**
3. Name: `Bekleidungsverwaltung`
4. Supported account types: **Accounts in this organizational directory only**
5. Redirect URI: 
   - Type: **Web**
   - URL: `http://localhost/auth/callback`
6. **Register** klicken

#### Client Secret erstellen
1. In der App → **Certificates & secrets**
2. **New client secret**
3. Description: `Bekleidung API`
4. Expires: **24 months**
5. **Add** und Secret **sofort kopieren!**

#### API Permissions
1. **API permissions** → **Add a permission**
2. **Microsoft Graph** → **Delegated permissions**
3. Folgende Berechtigungen hinzufügen:
   - `User.Read`
   - `email`
   - `profile`
   - `openid`
4. Optional für Mitarbeiter-Sync:
   - `User.Read.All` (erfordert Admin-Zustimmung)
5. **Grant admin consent** klicken

#### Werte notieren
- **Application (client) ID**
- **Directory (tenant) ID**
- **Client secret** (Value, nicht Secret ID!)

### 3️⃣ Umgebungsvariablen konfigurieren

Bearbeite `.env` in Root:
```env
# Microsoft Entra ID
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<your-client-id>
AZURE_CLIENT_SECRET=<your-client-secret>
AZURE_REDIRECT_URI=http://localhost/auth/callback

# JWT Secret (generiere einen zufälligen String!)
JWT_SECRET=<random-secure-string-min-32-chars>

# API URL
VITE_API_URL=http://localhost:3000/api
```

**Wichtig:** Ändere `JWT_SECRET` zu einem sicheren, zufälligen String!

```powershell
# Zufälligen String generieren (PowerShell)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 4️⃣ Anwendung starten

```powershell
# Docker Container bauen und starten
docker-compose up -d

# Logs verfolgen
docker-compose logs -f

# Status prüfen
docker-compose ps
```

### 5️⃣ Zugriff

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

### 6️⃣ Erster Login

1. Öffne http://localhost
2. Klicke **Mit Microsoft anmelden**
3. Melde dich mit deinem Microsoft-Konto an
4. Nach erfolgreichem Login wirst du zum Dashboard weitergeleitet

### 7️⃣ Admin-Rechte vergeben

Der erste Benutzer muss manuell Admin-Rechte erhalten:

```powershell
# In Backend-Container einloggen
docker exec -it bekleidung-backend sh

# SQLite öffnen
sqlite3 /app/data/bekleidung.db

# Admin-Rechte vergeben (Email anpassen!)
UPDATE employees SET role = 'ADMIN' WHERE email = 'deine.email@autohaus.de';

# Prüfen
SELECT email, role FROM employees;

# Exit
.exit
exit
```

---

## 🔧 Entwicklungsmodus

### Ohne Docker (lokal entwickeln)

#### Backend
```powershell
cd backend

# Dependencies installieren
npm install

# .env Datei erstellen
Copy-Item .env.example .env
# .env bearbeiten und Werte eintragen

# Prisma generieren
npm run prisma:generate

# Datenbank migrieren
npm run prisma:migrate

# Dev-Server starten
npm run dev
```

Backend läuft auf: http://localhost:3000

#### Frontend
```powershell
cd frontend

# Dependencies installieren
npm install

# .env Datei erstellen
Copy-Item .env.example .env
# .env bearbeiten

# Dev-Server starten
npm run dev
```

Frontend läuft auf: http://localhost:5173

---

## 📦 Produktion

### Optimierungen für Produktion

#### 1. HTTPS aktivieren
Verwende einen Reverse Proxy (z.B. nginx, Traefik) vor der Anwendung:

```yaml
# docker-compose.prod.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
```

#### 2. Sichere Secrets
- Verwende **Docker Secrets** oder **Azure Key Vault**
- Niemals Secrets in Git committen
- `.env` Dateien in `.gitignore`

#### 3. Backup automatisieren
```powershell
# Backup-Script in scripts/backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
sqlite3 /app/data/bekleidung.db ".backup /app/backups/bekleidung_$DATE.db"
find /app/backups -name "bekleidung_*.db" -mtime +30 -delete
```

Cron-Job einrichten:
```
0 2 * * * /app/scripts/backup.sh
```

#### 4. Monitoring
- Logs: `docker-compose logs -f`
- Health Check: `curl http://localhost:3000/api/health`
- Disk Space überwachen (SQLite wächst)

---

## 🔄 Updates & Wartung

### Anwendung aktualisieren
```powershell
# Container stoppen
docker-compose down

# Code aktualisieren (Git Pull oder neue Version)
git pull

# Neu bauen und starten
docker-compose up -d --build

# Logs prüfen
docker-compose logs -f
```

### Datenbank-Migrationen
```powershell
# In Backend-Container
docker exec -it bekleidung-backend sh

# Migration anwenden
npx prisma migrate deploy

# Exit
exit
```

### Backup wiederherstellen

#### Via Web-UI (Empfohlen)
```powershell
# 1. Gehe zu Einstellungen → Sicherung
# 2. Klicke "ZIP-Backup importieren"
# 3. Wähle eine zuvor erstellte Backup-ZIP-Datei
# 4. Import wird durchgeführt:
#    - ✅ Datenbank wird wiederhergestellt
#    - ✅ Bilder werden wiederhergestellt
#    - ✅ Protokolle werden wiederhergestellt
#    - ✅ Benutzerrollen & Sichtbarkeit
# 5. Automatische Bildvalidierung wird ausgelöst
# 6. Report zeigt Validierungsergebnis
```

#### Via Kommandozeile
```powershell
# Backup-Datei in Ordner kopieren
Copy-Item .\bekleidung-backup-20260120.zip .\backups\

# Script ausführen
docker exec bekleidung-backend sh /app/scripts/restore.sh /app/backups/bekleidung-backup-20260120.zip

# Fortschritt überwachen
docker-compose logs -f backend
```

#### Was wird wiederhergestellt?
✅ **Komplette Datenbank:**
- Alle Mitarbeiter (mit Rolle und Sichtbarkeit!)
- Alle Kleidungstypen (mit Bildern)
- Alle Kleidungsstücke (mit Bildern)
- Alle Transaktionen
- Alle Audit-Logs

✅ **Dateien:**
- Alle Kleidungs-Bilder
- Firmen-Logo
- Protokoll-PDFs
- Unterschrift-Bilder

✅ **Automatische Validierung:**
- Nach dem Import werden alle Bilder validiert
- Report zeigt: "✅ 130/130 Bilder gefunden"
- Bei fehlenden Bildern: Warnung mit Details

---

## �️ Bildvalidierung nach Import

Nach jedem Backup-Import wird **automatisch eine Bildvalidierung** durchgeführt:

### Was passiert?
1. **Bildreferences in DB prüfen** - Welche Bilder sollten vorhanden sein?
2. **Dateisystem durchsuchen** - Welche Bilder sind tatsächlich da?
3. **Report generieren** - Status und Detailinformationen

### Mögliche Szenarien

**✅ Alles OK**
- Alle 130 Bilder gefunden
- Sie sehen die Bilder sofort bei den Kleidungstypen

**⚠️ Einige Bilder fehlen**
- Report zeigt: "❌ 10 Bilder fehlen"
- Frontend zeigt Platzhalter für fehlende Bilder
- Lösung: Manuelle Bilderfassung oder erneuter Import

**🗑️ Waisendateien vorhanden**
- Es gibt Bilder im Dateisystem, die keine DB-Referenz haben
- Diese können sicher gelöscht werden
- Beeinflussen die Funktionalität nicht

### Validierungsbericht ansehen

In Einstellungen → Sicherung:
1. Klicke "Bilder validieren"
2. Detaillierter Report öffnet sich
3. Zeigt kategorisiert:
   - ✅ Gefundene Bilder (mit Pfad)
   - ❌ Fehlende Bilder (mit erwarteter Pfad)
   - 🗑️ Waisendateien (orphaned files)

---

### Problem: Login funktioniert nicht
**Lösung:**
1. Redirect URI in Azure AD prüfen
2. `.env` Werte prüfen (AZURE_CLIENT_ID, AZURE_TENANT_ID)
3. Browser-Konsole auf Fehler prüfen
4. Backend-Logs: `docker-compose logs backend`

### Problem: "Database locked" Fehler
**Lösung:**
- SQLite unterstützt nur einen Schreiber gleichzeitig
- Prüfe, ob mehrere Backend-Instanzen laufen
- Bei hoher Last: Erwäge Migration zu PostgreSQL

### Problem: Container startet nicht
**Lösung:**
```powershell
# Logs ansehen
docker-compose logs backend
docker-compose logs frontend

# Container neu bauen
docker-compose down
docker-compose up -d --build --force-recreate
```

### Problem: Bilder werden nach Import nicht angezeigt
**Lösung:**
1. Gehe zu Einstellungen → Sicherung
2. Klicke "Bilder validieren"
3. Überprüfe den Report:
   - Sind Bilder in der DB referenziert? (sollte nicht 0/0 sein)
   - Existieren die Dateien im Dateisystem?
4. Falls fehlend: Backup hat die Bilder möglicherweise nicht enthält
5. Lösung: Backup mit Bildern erstellen und erneut importieren

---

## 📊 Datenbankmanagement

### SQLite Studio verwenden
```powershell
# SQLite Studio herunterladen: https://sqlitestudio.pl/

# Datenbankdatei öffnen:
# ./data/bekleidung.db
```

### Prisma Studio (Dev-Tool)
```powershell
cd backend
npm run prisma:studio
```
Öffnet: http://localhost:5555

### Datenbank-Schema aktualisieren
```powershell
cd backend

# Schema in prisma/schema.prisma bearbeiten

# Migration erstellen
npm run prisma:migrate -- --name add_new_field

# Anwenden
npm run prisma:deploy
```

---

## 🔐 Sicherheit

### Best Practices
1. **JWT Secret** niemals teilen oder committen
2. **Client Secret** regelmäßig rotieren (Azure AD)
3. **HTTPS** in Produktion zwingend erforderlich
4. **Rate Limiting** ist aktiviert (100 Requests / 15 Min)
5. **Backups** verschlüsseln bei Speicherung außerhalb
6. **Updates** regelmäßig einspielen

### Rollenkonzept
- **ADMIN**: Volle Rechte
- **WAREHOUSE**: Kleidung verwalten, ausgeben, zurücknehmen
- **HR**: Lesen, Reports, keine Änderungen
- **READ_ONLY**: Nur Ansicht

### Benutzerrollen & Sichtbarkeit nach Import
**Wichtig:**
- Bei Backup & Import werden **Rollen erhalten**!
- Ein Admin bleibt Admin, auch nach Restore
- Versteckte Benutzer bleiben versteckt
- Dies ist neu seit v1.1 (Januar 2026)

### SQLite optimieren
```sql
-- In sqlite3
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=-64000;
PRAGMA temp_store=MEMORY;
```

### Uploads bereinigen
Alte Signaturen und Bilder regelmäßig archivieren:
```powershell
# Finde Dateien älter als 1 Jahr
Get-ChildItem .\uploads -Recurse | Where-Object { $_.LastWriteTime -lt (Get-Date).AddYears(-1) }
```

---

## 🆘 Support & Kontakt

Bei Problemen:
1. Logs prüfen: `docker-compose logs`
2. Dokumentation durchlesen
3. Issue erstellen (falls GitHub)

---

## 📝 Lizenz

Dieses Projekt ist für den internen Gebrauch im Autohaus bestimmt.
UNLICENSED - Alle Rechte vorbehalten.
