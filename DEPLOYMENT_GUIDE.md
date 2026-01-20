# 🚀 Deployment & Server-Migration Guide

## Server-Migration Checkliste

### 1. Vorbereitung auf dem alten Server

```powershell
# 1. Backup erstellen
cd \\ALTSERVER\wwwroot\productiv\bekleidung
.\scripts\backup.sh

# 2. Backup-Datei sichern
# Datei aus ./backups/backup_YYYY-MM-DD_HH-MM-SS.tar.gz kopieren
```

### 2. Installation auf neuem Server

```powershell
# 1. Code auf neuen Server kopieren
# Komplettes Verzeichnis nach \\NEUSERVER\wwwroot\productiv\bekleidung

# 2. Node.js installieren (Version 18+)
# Download von https://nodejs.org/

# 3. Dependencies installieren
cd \\NEUSERVER\wwwroot\productiv\bekleidung\backend
npm install

cd \\NEUSERVER\wwwroot\productiv\bekleidung\frontend
npm install
```

### 3. Konfiguration anpassen

#### **WICHTIG: Nur diese Datei muss angepasst werden!**

**Datei**: `backend\.env`

```bash
# ========================================
# HOST KONFIGURATION - HIER ANPASSEN!
# ========================================

# Neuer Hostname (z.B. de402850sahapp, production-server, etc.)
APP_HOST=NEUSERVER_HOSTNAME

# Ports (nur bei Bedarf ändern)
FRONTEND_PORT=3078
BACKEND_PORT=3077

# ========================================
# AZURE REDIRECT URI - AUTOMATISCH AKTUALISIEREN!
# ========================================
# Diese URL muss auch in Azure Entra ID registriert werden!
AZURE_REDIRECT_URI=https://NEUSERVER_HOSTNAME:3078/auth/callback

# ========================================
# Alle anderen Werte bleiben gleich
# ========================================
```

### 4. Azure Entra ID aktualisieren

1. **Azure Portal öffnen**: https://portal.azure.com
2. **Entra ID** → **App Registrations** → Ihre App auswählen
3. **Authentication** → **Platform configurations** → **Web**
4. **Redirect URI hinzufügen**:
   ```
   https://NEUSERVER_HOSTNAME:3078/auth/callback
   ```
5. **Speichern**

### 5. Datenbank wiederherstellen

```powershell
# 1. Backup-Datei kopieren nach \\NEUSERVER\wwwroot\productiv\bekleidung\backups\

# 2. Restore ausführen
cd \\NEUSERVER\wwwroot\productiv\bekleidung
.\scripts\restore.sh backup_YYYY-MM-DD_HH-MM-SS.tar.gz
```

### 6. Anwendung starten

```powershell
# Terminal 1 - Backend
cd \\NEUSERVER\wwwroot\productiv\bekleidung\backend
npm run dev

# Terminal 2 - Frontend
cd \\NEUSERVER\wwwroot\productiv\bekleidung\frontend
npm run dev
```

### 7. Testen

1. **Frontend öffnen**: `https://NEUSERVER_HOSTNAME:3078`
2. **Login testen** mit Entra ID
3. **Dashboard prüfen** - Daten vorhanden?
4. **Transaktion testen** - Email-Versand funktioniert?
5. **QR-Code testen** - Scannen funktioniert?

---

## Umgebungsvariablen Übersicht

### **Host & Port Konfiguration**

| Variable | Beschreibung | Beispiel | Auswirkung |
|----------|--------------|----------|------------|
| `APP_HOST` | Hostname des Servers | `de401850sahapp` | URLs in Emails, Redirects |
| `FRONTEND_PORT` | Port für Frontend (Vite) | `3078` | Frontend-URL |
| `BACKEND_PORT` | Port für Backend (Express) | `3077` | API-URL |
| `AZURE_REDIRECT_URI` | OAuth Redirect | `https://HOST:PORT/auth/callback` | Login-Flow |

### **Verwendung im Code**

Alle URLs werden **automatisch** aus den ENV-Variablen generiert:

```typescript
// Email-Service (email.service.ts)
const assetBase = `https://${process.env.APP_HOST}:${process.env.FRONTEND_PORT}`;

// Confirmation URLs (transaction.routes.ts)
const confirmationUrl = `https://${process.env.APP_HOST}:${process.env.FRONTEND_PORT}/confirm/${token}`;

// Bild-URLs (transaction.routes.ts)
const imageUrl = `https://${process.env.APP_HOST}:${process.env.FRONTEND_PORT}${relativeImageUrl}`;
```

**Wichtig**: Im Code gibt es **KEINE** hardcodierten Hostnamen mehr!

---

## Multi-Firma / Mandantenfähigkeit

Falls Sie mehrere Standorte betreiben:

### Option 1: Separate Instanzen

Jeder Standort bekommt eigenen Server:

```
Standort A: \\server-a\wwwroot\productiv\bekleidung (APP_HOST=server-a)
Standort B: \\server-b\wwwroot\productiv\bekleidung (APP_HOST=server-b)
```

### Option 2: Eine Instanz mit Standort-Feld

Datenbank erweitern:

```prisma
model Location {
  id          String   @id @default(cuid())
  name        String
  hostname    String   @unique
  employees   Employee[]
  clothing    ClothingItem[]
}
```

---

## Troubleshooting

### Problem: Login funktioniert nicht

**Ursache**: Redirect URI nicht in Azure registriert

**Lösung**:
1. Azure Portal → App Registration → Authentication
2. Redirect URI hinzufügen: `https://NEUSERVER_HOSTNAME:3078/auth/callback`
3. Speichern & neu versuchen

### Problem: Bilder werden nicht angezeigt

**Ursache**: APP_HOST nicht korrekt gesetzt

**Lösung**:
1. `backend\.env` prüfen: `APP_HOST=NEUSERVER_HOSTNAME`
2. Backend neu starten: `npm run dev`

### Problem: Emails enthalten falsche URLs

**Ursache**: ENV-Variablen nicht geladen

**Lösung**:
1. `backend\.env` prüfen
2. Konsole prüfen: `console.log('APP_HOST:', process.env.APP_HOST)`
3. Backend neu starten

### Problem: "Cannot find module" Fehler

**Ursache**: Dependencies nicht installiert

**Lösung**:
```powershell
cd backend
npm install

cd ../frontend
npm install
```

---

## Automatisierung (optional)

### PowerShell-Script für schnellen Umzug

```powershell
# deploy-to-new-server.ps1

param(
    [Parameter(Mandatory=$true)]
    [string]$NewHostname,
    
    [Parameter(Mandatory=$true)]
    [string]$NewServerPath
)

Write-Host "=== Bekleidung-App Deployment ===" -ForegroundColor Green

# 1. Backup erstellen
Write-Host "1. Erstelle Backup..." -ForegroundColor Yellow
.\scripts\backup.sh

# 2. Code kopieren
Write-Host "2. Kopiere Code nach $NewServerPath..." -ForegroundColor Yellow
Copy-Item -Path "." -Destination $NewServerPath -Recurse -Force

# 3. .env aktualisieren
Write-Host "3. Aktualisiere .env..." -ForegroundColor Yellow
$envPath = "$NewServerPath\backend\.env"
(Get-Content $envPath) -replace 'APP_HOST=.*', "APP_HOST=$NewHostname" | Set-Content $envPath
(Get-Content $envPath) -replace 'AZURE_REDIRECT_URI=.*', "AZURE_REDIRECT_URI=https://${NewHostname}:3078/auth/callback" | Set-Content $envPath

# 4. Dependencies installieren
Write-Host "4. Installiere Dependencies..." -ForegroundColor Yellow
cd "$NewServerPath\backend"
npm install

cd "$NewServerPath\frontend"
npm install

Write-Host "=== Deployment abgeschlossen! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Nächste Schritte:" -ForegroundColor Yellow
Write-Host "1. Azure Redirect URI hinzufügen: https://${NewHostname}:3078/auth/callback"
Write-Host "2. Backend starten: cd backend && npm run dev"
Write-Host "3. Frontend starten: cd frontend && npm run dev"
```

**Verwendung**:
```powershell
.\deploy-to-new-server.ps1 -NewHostname "production-server" -NewServerPath "\\production-server\wwwroot\productiv\bekleidung"
```

---

## Sicherheits-Checkliste

- [ ] `.env`-Datei nicht in Git einchecken (bereits in `.gitignore`)
- [ ] JWT_SECRET ändern für Produktion
- [ ] SMTP-Passwort sicher verwahren
- [ ] Azure Client Secret regelmäßig rotieren
- [ ] Backup-Strategie testen (alle 7 Tage)
- [ ] HTTPS-Zertifikat gültig (selbst-signiert oder offiziell)
- [ ] Firewall: Nur Ports 3077, 3078 öffnen

---

## Kontakt & Support

Bei Problemen:

1. **Logs prüfen**:
   ```
   backend/logs/error-YYYY-MM-DD.log
   backend/logs/combined-YYYY-MM-DD.log
   ```

2. **Console Output** im Terminal prüfen

3. **Database-Konsistenz** prüfen:
   ```powershell
   cd backend
   npx prisma studio
   ```

4. **Health-Check** ausführen:
   ```powershell
   .\scripts\health-check.sh
   ```

---

**Version**: 1.0  
**Letzte Aktualisierung**: 20. Januar 2026  
**Autor**: System
