# 🔄 Automatische Backup-Konfiguration

## Übersicht

Das automatische Backup-System erstellt regelmäßige Backups Ihrer Datenbank nach einem konfigurierbaren Zeitplan. Alle Backups werden im selben Format wie manuelle Backups erstellt (ZIP mit CSV-Dateien, Bildern und Protokollen).

---

## ✨ Features

### Zeitplan-Optionen
- **Täglich**: Backup jeden Tag zur gleichen Uhrzeit
- **Wöchentlich**: Backup an einem bestimmten Wochentag
- **Monatlich**: Backup an einem bestimmten Tag des Monats

### Automatische Verwaltung
- **Aufbewahrung**: Alte Backups werden automatisch nach X Tagen gelöscht
- **Email-Benachrichtigungen**: Optional bei Erfolg oder Fehler
- **Nächster Lauf**: Automatische Berechnung der nächsten Ausführungszeit

### Flexibilität
- **Ein/Aus-Schalter**: Zeitpläne können aktiviert/deaktiviert werden
- **Manuelle Ausführung**: "Jetzt ausführen" Button für sofortiges Backup
- **Mehrere Zeitpläne**: Erstellen Sie beliebig viele Backup-Strategien

---

## 📋 Setup

### 1. Backend-Installation

```powershell
# Navigiere zum Backend-Ordner
cd \\de401850sahapp\wwwroot\productiv\bekleidung\backend

# Installiere node-cron Package
npm install node-cron@^3.0.3

# Generiere Prisma Client mit neuer Tabelle
npx prisma generate

# Führe Migration aus
npx prisma migrate deploy
```

### 2. Backend neu starten

```powershell
# Stoppe den aktuellen Server (Ctrl+C)
# Starte neu
npm run dev
```

Sie sollten im Console-Log sehen:
```
[info]: Backup scheduler initialized
```

---

## 🎯 Verwendung

### Neuen Backup-Zeitplan erstellen

1. **Einstellungen öffnen**: Navigieren Sie zu `/settings`
2. **Backup-Tab**: Klicken Sie auf den "Backup" Tab
3. **Neuer Zeitplan**: Scrollen Sie nach unten zur "Automatische Backups" Sektion
4. **Button klicken**: "Neuer Zeitplan"
5. **Formular ausfüllen**:
   - **Frequenz**: DAILY / WEEKLY / MONTHLY
   - **Stunde**: 0-23 (24-Stunden-Format)
   - **Minute**: 0-59
   - **Wochentag** (nur bei WEEKLY): Montag-Sonntag
   - **Tag des Monats** (nur bei MONTHLY): 1-31
   - **Aufbewahrung**: Anzahl Tage, bevor alte Backups gelöscht werden
   - **Email-Benachrichtigung**: Optional, Email-Adresse für Notifications
   - **Optionen**:
     - Bilder einschließen (empfohlen)
     - Protokolle einschließen (empfohlen)
     - Benachrichtigung bei Erfolg
     - Benachrichtigung bei Fehler
   - **Aktiviert**: Checkbox zum sofortigen Aktivieren
6. **Speichern**

### Beispiel-Konfigurationen

#### Täglich um 2 Uhr nachts
```
Frequenz: DAILY
Stunde: 2
Minute: 0
Aufbewahrung: 30 Tage
```

#### Jeden Sonntag um 3 Uhr
```
Frequenz: WEEKLY
Stunde: 3
Minute: 0
Wochentag: Sonntag (0)
Aufbewahrung: 90 Tage
```

#### Monatlich am 1. um 1 Uhr
```
Frequenz: MONTHLY
Stunde: 1
Minute: 0
Tag des Monats: 1
Aufbewahrung: 365 Tage
```

---

## 🔧 Verwaltung

### Aktionen in der Tabelle

| Aktion | Beschreibung |
|--------|--------------|
| **Jetzt** | Führt Backup sofort aus (ignoriert Zeitplan) |
| **Aktivieren/Deaktivieren** | Schaltet Zeitplan ein/aus |
| **Bearbeiten** | Öffnet Formular zum Ändern der Konfiguration |
| **Löschen** | Entfernt Zeitplan permanent |

### Status-Tags

| Tag | Bedeutung |
|-----|-----------|
| 🟢 **Aktiv** | Zeitplan ist aktiviert |
| ⚪ **Inaktiv** | Zeitplan ist deaktiviert |
| ✅ **OK** | Letztes Backup erfolgreich |
| ❌ **Fehler** | Letztes Backup fehlgeschlagen |

---

## 📧 Email-Benachrichtigungen

### Erfolg-Email

```
Betreff: ✅ Automatisches Backup erfolgreich

Backup erfolgreich erstellt

Das automatische Backup wurde erfolgreich durchgeführt.

• Dateiname: auto-backup-2026-01-20_02-00.zip
• Größe: 15.3 MB
• Dauer: 8.2 Sekunden
• Zeitpunkt: 20.01.2026 02:00:15
```

### Fehler-Email

```
Betreff: ❌ Automatisches Backup fehlgeschlagen

Backup fehlgeschlagen

Das automatische Backup ist fehlgeschlagen.

• Fehler: ENOENT: no such file or directory
• Dauer: 2.1 Sekunden
• Zeitpunkt: 20.01.2026 02:00:03

Bitte prüfen Sie die Server-Logs für weitere Details.
```

---

## 📁 Backup-Dateien

### Speicherort

Backups werden gespeichert in:
```
\\de401850sahapp\wwwroot\productiv\bekleidung\backend\backups\
```

### Dateinamen

Automatische Backups haben folgendes Format:
```
auto-backup-2026-01-20_02-00.zip
auto-backup-YYYY-MM-DD_HH-MM.zip
```

Manuelle Backups:
```
bekleidung-backup-2026-01-20.zip
```

### Automatische Löschung

Backups älter als `retentionDays` werden automatisch gelöscht:
- Läuft bei jedem Backup-Job
- Betrifft nur Dateien mit Präfix `auto-backup-`
- Manuelle Backups werden NICHT gelöscht

---

## 🔍 Monitoring

### Scheduler-Status prüfen

API-Endpoint (nur ADMIN):
```http
GET /api/backup-config/scheduler/status
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "activeBackups": 2,
    "scheduledIds": ["clx123...", "clx456..."]
  }
}
```

### Logs prüfen

```powershell
# Live Logs anschauen
cd \\de401850sahapp\wwwroot\productiv\bekleidung\backend
Get-Content -Path logs\combined-2026-01-20.log -Wait -Tail 50

# Nach Backup-Einträgen suchen
Select-String -Path "logs\combined-*.log" -Pattern "BackupScheduler"
```

Log-Beispiel:
```
[2026-01-20 02:00:00] [info]: [BackupScheduler] Starting backup execution for clx123...
[2026-01-20 02:00:08] [info]: [BackupScheduler] Backup clx123 completed: auto-backup-2026-01-20_02-00.zip (15.3 MB in 8.2s)
[2026-01-20 02:00:09] [info]: [BackupScheduler] Cleanup completed: 3 old backup(s) deleted
```

---

## ⚙️ API-Referenz

### Endpoints (alle nur für ADMIN)

#### Alle Konfigurationen abrufen
```http
GET /api/backup-config
Authorization: Bearer <token>
```

#### Einzelne Konfiguration abrufen
```http
GET /api/backup-config/:id
Authorization: Bearer <token>
```

#### Neue Konfiguration erstellen
```http
POST /api/backup-config
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": true,
  "frequency": "DAILY",
  "hour": 2,
  "minute": 0,
  "retentionDays": 30,
  "includeImages": true,
  "includeProtocols": true,
  "notifyOnSuccess": true,
  "notifyOnError": true,
  "notificationEmail": "admin@example.com"
}
```

#### Konfiguration aktualisieren
```http
PUT /api/backup-config/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "hour": 3,
  "notificationEmail": "new-admin@example.com"
}
```

#### Konfiguration löschen
```http
DELETE /api/backup-config/:id
Authorization: Bearer <token>
```

#### Aktivieren/Deaktivieren
```http
POST /api/backup-config/:id/toggle
Authorization: Bearer <token>
```

#### Sofort ausführen
```http
POST /api/backup-config/:id/run-now
Authorization: Bearer <token>
```

---

## 🐛 Troubleshooting

### Problem: Backup wird nicht ausgeführt

**Lösung 1**: Status prüfen
- Ist der Zeitplan aktiviert? (grüner "Aktiv" Tag)
- Liegt "Nächste Ausführung" in der Zukunft?

**Lösung 2**: Logs prüfen
```powershell
Get-Content logs\combined-*.log | Select-String "BackupScheduler"
```

**Lösung 3**: Backend neu starten
```powershell
# Strg+C zum Stoppen
npm run dev
```

### Problem: Email-Benachrichtigung kommt nicht an

**Ursache**: SMTP nicht konfiguriert oder falsche Email-Adresse

**Lösung**:
1. `.env` prüfen:
```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=edv@autohaus-graupner.de
SMTP_PASS=***
```

2. Email-Adresse in Konfiguration korrekt?
3. Logs prüfen:
```
[BackupScheduler] Notification email sent to admin@example.com
```

### Problem: "Fehler beim Speichern"

**Ursache**: Validierungsfehler

**Lösung**:
- Stunde muss 0-23 sein
- Minute muss 0-59 sein
- Bei WEEKLY: Wochentag muss 0-6 sein
- Bei MONTHLY: Tag muss 1-31 sein

### Problem: Backup-Datei zu groß

**Ursache**: Viele Bilder und Protokolle

**Lösung**:
1. Optionen deaktivieren:
   - "Bilder einschließen" ausschalten
   - "Protokolle einschließen" ausschalten

2. Kürzere Aufbewahrung → weniger alte Backups:
   - Retention Days auf 7-14 Tage setzen

---

## 📊 Best Practices

### Empfohlene Konfigurationen

#### Produktionsumgebung
```yaml
Zeitplan 1 (Täglich):
  Frequenz: DAILY
  Stunde: 2
  Minute: 0
  Aufbewahrung: 7 Tage
  Email: admin@firma.de

Zeitplan 2 (Wöchentlich):
  Frequenz: WEEKLY
  Wochentag: Sonntag
  Stunde: 3
  Minute: 0
  Aufbewahrung: 90 Tage
  Email: backup@firma.de
```

#### Entwicklungsumgebung
```yaml
Zeitplan:
  Frequenz: WEEKLY
  Wochentag: Freitag
  Stunde: 18
  Minute: 0
  Aufbewahrung: 14 Tage
  Email: dev@firma.de
```

### Sicherheit

✅ **DO**:
- Regelmäßige Backups (täglich minimum)
- Lang-aufbewahrung für Sonntags-Backups (90+ Tage)
- Email-Benachrichtigungen aktivieren
- Manuelle Tests durchführen (Jetzt-Button)

❌ **DON'T**:
- Alle Backups auf 1 Tag Retention setzen
- Email-Benachrichtigungen deaktivieren
- Nur 1 Zeitplan verwenden
- Backups nie wiederherstellen testen

---

## 🔐 Sicherheit

### Berechtigungen

- **ADMIN**: Voller Zugriff (erstellen, bearbeiten, löschen, ausführen)
- **HR**: Keine Berechtigung für automatische Backups
- **WAREHOUSE**: Keine Berechtigung
- **READ_ONLY**: Keine Berechtigung

### Backup-Dateien

- Gespeichert im Backend-Ordner (nicht öffentlich zugänglich)
- Nur über API mit Authentication downloadbar
- Enthalten sensible Daten → sicher aufbewahren!

---

## 📞 Support

Bei Problemen:

1. **Logs prüfen**: `backend/logs/combined-YYYY-MM-DD.log`
2. **Status prüfen**: GET `/api/backup-config/scheduler/status`
3. **Backend neu starten**: `npm run dev`
4. **Migration prüfen**: `npx prisma migrate status`

---

**Version**: 1.0  
**Letzte Aktualisierung**: 20. Januar 2026  
**Autor**: System
