# Garderobe - Kunden-spezifische Konfiguration

Schritt-für-Schritt-Anleitung zur Konfiguration des Garderobe-Systems für Ihren spezifischen Einsatz.

## 📋 Übersicht

Nach der Installation mit `./deployment/setup.sh` müssen Sie folgende kundenspezifische Konfigurationen vornehmen:

1. ✅ Microsoft Entra ID (Azure AD) einrichten
2. ✅ SMTP Email-Konfiguration
3. ✅ SSL-Zertifikate (falls noch nicht erledigt)
4. ✅ Ersten Admin-Benutzer einrichten
5. ✅ System-Anpassungen (optional)

---

## 1️⃣ Microsoft Entra ID (Azure AD) Einrichtung

### Warum Entra ID?

Das Garderobe-System nutzt **Microsoft Entra ID** (ehemals Azure Active Directory) für die Authentifizierung. Das bedeutet:

- ✅ Mitarbeiter melden sich mit ihrem **Microsoft 365 Account** an
- ✅ **Keine separaten Passwörter** für das Garderobe-System nötig
- ✅ **Zentrale Benutzerverwaltung** in Ihrem Azure Portal
- ✅ **Automatische Synchronisation** mit Azure AD

### Schritt 1: Azure Portal öffnen

1. Gehen Sie zu: [https://portal.azure.com](https://portal.azure.com)
2. Melden Sie sich mit Ihrem **Administrator-Account** an

### Schritt 2: App-Registrierung erstellen

1. Im Azure Portal: Linkes Menü → **Azure Active Directory** (oder suchen Sie nach "Entra ID")
2. Im Menü → **App-Registrierungen** (*App registrations*)
3. Klicken Sie auf **+ Neue Registrierung** (*+ New registration*)

### Schritt 3: App-Details eingeben

**Name:**
```
Garderobe System
```
oder einen Namen Ihrer Wahl (z.B. "Arbeitskleidung-Verwaltung")

**Unterstützte Kontotypen:**
- ☑️ **Nur Konten in diesem Organisationsverzeichnis** (*Accounts in this organizational directory only*)
- Dies ist die empfohlene und sicherste Option

**Redirect URI:**
- **Typ**: Web
- **URI**: `https://ihr-server-domain:3078/auth/callback`

⚠️ **WICHTIG**: Ersetzen Sie `ihr-server-domain` mit:
- Ihrer **echten Server-Domain** (z.B. `garderobe.firma.de`)
- Oder der **IP-Adresse** (z.B. `192.168.1.100`)
- Oder dem **Hostnamen** (z.B. `server01.firma.local`)

**Beispiele:**
```
https://garderobe.firma.de:3078/auth/callback
https://192.168.1.100:3078/auth/callback
https://server01.firma.local:3078/auth/callback
```

4. Klicken Sie auf **Registrieren** (*Register*)

### Schritt 4: IDs notieren

Nach der Registrierung sehen Sie die **Übersicht** (*Overview*) der App.

Kopieren Sie diese Werte:

| Feld | Wert notieren |
|------|---------------|
| **Anwendungs-ID (Client)** | z.B. `12345678-1234-1234-1234-123456789abc` |
| **Verzeichnis-ID (Mandant)** | z.B. `87654321-4321-4321-4321-cba987654321` |

📝 Diese benötigen Sie später für die `.env`-Datei.

### Schritt 5: Client Secret erstellen

1. Im linken Menü → **Zertifikate & Geheimnisse** (*Certificates & secrets*)
2. Tab **Geheime Clientschlüssel** (*Client secrets*)
3. Klicken Sie auf **+ Neuer geheimer Clientschlüssel** (*+ New client secret*)

**Einstellungen:**
- **Beschreibung**: `Garderobe System Secret`
- **Läuft ab**: **24 Monate** (empfohlen)

4. Klicken Sie auf **Hinzufügen** (*Add*)

⚠️ **KRITISCH**: Kopieren Sie den **Wert** (*Value*) SOFORT!
- Der Wert wird nur **EINMAL** angezeigt
- Nach dem Verlassen der Seite können Sie ihn **NICHT** mehr sehen
- Sie müssten einen neuen Secret erstellen

📝 Notieren Sie den Secret-Wert für die `.env`-Datei.

### Schritt 6: API-Berechtigungen setzen

1. Im linken Menü → **API-Berechtigungen** (*API permissions*)
2. Klicken Sie auf **+ Berechtigung hinzufügen** (*+ Add a permission*)
3. Wählen Sie **Microsoft Graph**
4. Wählen Sie **Delegierte Berechtigungen** (*Delegated permissions*)

**Fügen Sie diese Berechtigungen hinzu:**

| Berechtigung | Beschreibung |
|--------------|--------------|
| `openid` | Anmeldung und Benutzerprofil lesen |
| `profile` | Grundlegende Profilinformationen |
| `email` | E-Mail-Adresse des Benutzers |
| `User.Read` | Benutzerprofil lesen |

5. Klicken Sie auf **Berechtigungen hinzufügen** (*Add permissions*)
6. Klicken Sie auf **Administratorzustimmung erteilen für [Ihre Organisation]** (*Grant admin consent for [Your Organization]*)
7. Bestätigen Sie mit **Ja** (*Yes*)

✅ Status sollte jetzt **grüne Häkchen** zeigen.

### Schritt 7: .env-Datei aktualisieren

Auf Ihrem Server:

```bash
cd /pfad/zu/gaderobe
nano .env
```

Aktualisieren Sie diese Zeilen:

```env
# ========================================
# MICROSOFT ENTRA ID
# ========================================
AZURE_TENANT_ID=ihre-verzeichnis-id-hier
AZURE_CLIENT_ID=ihre-anwendungs-id-hier
AZURE_CLIENT_SECRET=ihr-client-secret-hier
AZURE_REDIRECT_URI=https://ihr-server-domain:3078/auth/callback
```

**Beispiel mit echten Werten:**

```env
AZURE_TENANT_ID=87654321-4321-4321-4321-cba987654321
AZURE_CLIENT_ID=12345678-1234-1234-1234-123456789abc
AZURE_CLIENT_SECRET=abcDEF123~ghiJKL456-mnoPQR789
AZURE_REDIRECT_URI=https://garderobe.firma.de:3078/auth/callback
```

Speichern Sie mit: `Strg+O`, `Enter`, `Strg+X`

### Schritt 8: Anwendung neu starten

```bash
docker compose -f docker-compose.prod.yml restart
```

✅ Azure Entra ID ist jetzt konfiguriert!

---

## 2️⃣ SMTP Email-Konfiguration

Das System sendet Emails für:
- ✉️ **Transaktionsbestätigungen** (Ausgabe/Rückgabe)
- ✉️ **Backup-Benachrichtigungen** (Erfolg/Fehler)
- ✉️ **System-Benachrichtigungen**

### Option A: Office 365 / Microsoft 365 (empfohlen)

Wenn Ihr Unternehmen **Microsoft 365** nutzt:

```env
# ========================================
# EMAIL CONFIGURATION (SMTP)
# ========================================
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=garderobe@ihre-firma.de
SMTP_PASS=ihr-passwort
SMTP_FROM=Garderobe System <garderobe@ihre-firma.de>
```

**Schritte:**

1. Erstellen Sie ein **dediziertes Postfach** für das System (empfohlen):
   - Z.B. `garderobe@ihre-firma.de`
   - Oder nutzen Sie ein bestehendes Postfach

2. **Passwort notieren** oder App-Passwort erstellen (falls MFA aktiv)

3. **Testen Sie den Login**:
   ```bash
   # Im Outlook Web: https://outlook.office.com
   # Login mit dem Konto funktioniert? ✅
   ```

### Option B: Gmail

Falls Sie Gmail nutzen:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ihr-email@gmail.com
SMTP_PASS=ihr-app-passwort
SMTP_FROM=Garderobe System <ihr-email@gmail.com>
```

⚠️ **WICHTIG für Gmail**: Sie benötigen ein **App-Passwort**, nicht Ihr normales Passwort!

**App-Passwort erstellen:**

1. Gehen Sie zu: [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Aktivieren Sie **2-Faktor-Authentifizierung** (falls noch nicht aktiv)
3. Gehen Sie zu **App-Passwörter** (*App passwords*)
4. Erstellen Sie ein neues App-Passwort für "Mail"
5. Kopieren Sie das generierte 16-stellige Passwort
6. Nutzen Sie dieses Passwort in der `.env`-Datei

### Option C: Eigener SMTP-Server

Falls Ihr Unternehmen einen eigenen Mail-Server hat:

```env
SMTP_HOST=mail.ihre-firma.de
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=smtp-benutzer
SMTP_PASS=smtp-passwort
SMTP_FROM=Garderobe System <garderobe@ihre-firma.de>
```

**Typische Ports:**
- **587**: STARTTLS (empfohlen) → `SMTP_SECURE=false`
- **465**: SSL/TLS → `SMTP_SECURE=true`
- **25**: Unverschlüsselt (nicht empfohlen)

### SMTP-Konfiguration testen

```bash
# Container-Shell öffnen
docker compose -f docker-compose.prod.yml exec backend sh

# Test-Email senden
node -e "
const nodemailer = require('nodemailer');
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
transport.sendMail({
  from: process.env.SMTP_FROM,
  to: 'ihre-test-email@firma.de',
  subject: 'Garderobe System - Test Email',
  text: 'SMTP funktioniert! ✅'
}).then(() => console.log('Email gesendet!')).catch(console.error);
"

# Container verlassen
exit
```

✅ Prüfen Sie Ihren Posteingang!

---

## 3️⃣ SSL-Zertifikate

### Falls während Installation übersprungen

Wenn Sie während `./deployment/setup.sh` die SSL-Konfiguration übersprungen haben:

#### Option 1: Self-Signed (für Tests/Intranet)

```bash
./deployment/generate-ssl.sh --self-signed --domain ihr-server.firma.local --days 365
```

**Nachteile:**
- ⚠️ Browser-Warnung beim ersten Besuch
- ⚠️ Benutzer müssen Sicherheitsausnahme akzeptieren

**Für Intranet akzeptabel**, wenn:
- Alle Benutzer informiert sind
- Server nur intern erreichbar ist

#### Option 2: Let's Encrypt (für öffentliche Domains)

```bash
./deployment/generate-ssl.sh --letsencrypt \
  --domain garderobe.ihre-firma.de \
  --email admin@ihre-firma.de
```

**Voraussetzungen:**
- ✅ Domain muss **öffentlich erreichbar** sein
- ✅ Port **80** muss von außen erreichbar sein (für Validierung)
- ✅ DNS muss auf Ihren Server zeigen

**Vorteile:**
- ✅ **Kostenlos** und automatisch verlängert
- ✅ **Vertrauenswürdig** - keine Browser-Warnung
- ✅ **Standard in Production**

### Zertifikate überprüfen

```bash
# Zertifikat-Details anzeigen
openssl x509 -in ssl/cert.pem -text -noout

# Ablaufdatum prüfen
openssl x509 -in ssl/cert.pem -noout -enddate
```

### Anwendung nach SSL-Änderung neu starten

```bash
docker compose -f docker-compose.prod.yml restart
```

---

## 4️⃣ Ersten Admin-Benutzer einrichten

Nach erfolgreicher Azure-Konfiguration:

### Schritt 1: Erstmalige Anmeldung

1. Öffnen Sie: `https://ihr-server:3078`
2. Klicken Sie auf **"Sign in with Microsoft"**
3. Melden Sie sich mit Ihrem **Microsoft 365 Account** an
4. Akzeptieren Sie die Berechtigungen (falls gefragt)

✅ Sie sollten jetzt im Dashboard sein.

⚠️ **ABER**: Sie haben noch **keine Admin-Rechte**!

### Schritt 2: Admin-Rechte vergeben

Auf dem Server:

```bash
# Ersetzen Sie mit der Email, die Sie gerade verwendet haben
docker compose -f docker-compose.prod.yml exec backend node scripts/set-admin.js ihre-email@firma.de
```

**Beispiel:**
```bash
docker compose -f docker-compose.prod.yml exec backend node scripts/set-admin.js max.mustermann@firma.de
```

**Ausgabe:**
```
✅ User max.mustermann@firma.de is now an admin
```

### Schritt 3: Logout und erneuter Login

1. Im Garderobe-System: **Logout** (oben rechts)
2. **Erneut anmelden**
3. ✅ Sie sollten jetzt den **"Einstellungen"**-Button sehen

### Weitere Admins hinzufügen

Wiederholen Sie den Befehl für jeden Admin:

```bash
docker compose -f docker-compose.prod.yml exec backend node scripts/set-admin.js benutzer1@firma.de
docker compose -f docker-compose.prod.yml exec backend node scripts/set-admin.js benutzer2@firma.de
```

---

## 5️⃣ System-Anpassungen (Optional)

### Firmenname & Branding

Aktuell gibt es keine UI-basierte Branding-Konfiguration. Der Firmenname aus der `.env`-Datei wird im System genutzt:

```env
CUSTOMER_NAME=Ihre Firma GmbH
```

### Automatische Backups konfigurieren

1. Als Admin: **Einstellungen** → **Automatische Backups**
2. Klicken Sie auf **"Neue Konfiguration"**

**Empfohlene Einstellungen:**

| Feld | Empfehlung |
|------|------------|
| **Häufigkeit** | Täglich |
| **Uhrzeit** | 02:00 Uhr (nachts) |
| **Aufbewahrung** | 30 Tage |
| **Bilder einbeziehen** | Ja (falls genug Speicherplatz) |
| **Protokolle einbeziehen** | Ja |
| **Email-Benachrichtigung** | Ihre IT-Email |
| **Bei Erfolg benachrichtigen** | Nein (nur bei Problemen) |
| **Bei Fehler benachrichtigen** | **Ja** ✅ |

3. Klicken Sie auf **"Erstellen"**
4. ✅ Backup läuft jetzt automatisch!

### Dashboard anpassen (als Benutzer)

Jeder Benutzer kann sein Dashboard anpassen:

1. Dashboard öffnen
2. Oben rechts: **View-Modus** (Compact/Comfortable)
3. Oben rechts: **⚙️ Symbol** → Sections ein/ausblenden:
   - KPI-Karten
   - Top-Bekleidungstypen
   - Letzte Transaktionen
   - Status-Übersicht

Einstellungen werden **lokal im Browser** gespeichert.

### Mitarbeiter synchronisieren

Optional: Mitarbeiter automatisch aus Azure AD importieren:

```bash
docker compose -f docker-compose.prod.yml exec backend node scripts/getAllEmployees.ts
```

Oder: **Einstellungen** → **Mitarbeiter-Synchronisation** (falls implementiert)

---

## 🔍 Konfiguration überprüfen

### Checkliste

| Punkt | Status | Prüfen mit |
|-------|--------|------------|
| ✅ Azure Entra ID konfiguriert | ☐ | Login funktioniert? |
| ✅ SMTP funktioniert | ☐ | Test-Email senden |
| ✅ SSL-Zertifikat gültig | ☐ | Keine Browser-Warnung? |
| ✅ Admin-User eingerichtet | ☐ | "Einstellungen" sichtbar? |
| ✅ Backup-Zeitplan aktiv | ☐ | Einstellungen → Backups |
| ✅ .env-Datei gesichert | ☐ | Backup erstellen! |

### Konfiguration testen

1. **Login-Test**: Melden Sie sich mit 3 verschiedenen Benutzern an
2. **Email-Test**: Erstellen Sie eine Transaktion → Email erhalten?
3. **Backup-Test**: Einstellungen → Backup → "Jetzt sichern"
4. **Health-Check**: `https://ihr-server:3077/api/health` (sollte "ok" zurückgeben)

---

## 📱 Benutzer einweisen

### Für Standard-Benutzer

1. **URL mitteilen**: `https://ihr-server:3078`
2. **Login**: Mit Microsoft 365 Account anmelden
3. **Dashboard**: Zeigen Sie die Quick-Access Buttons
4. **Transaktion erstellen**: 
   - Button **"Transaktion"** → Ausgabe/Rückgabe
   - Mitarbeiter wählen
   - Kleidung wählen
   - Bestätigen
5. **Email-Bestätigung**: Prüfen Sie gemeinsam den Posteingang

### Für Admin-Benutzer

Zusätzlich:
- **Einstellungen**: Backup, Systemkonfiguration
- **Berichte**: Auswertungen erstellen
- **Bekleidungstypen**: Neue Typen anlegen
- **Mitarbeiterverwaltung**: Versteckte Mitarbeiter

---

## 🆘 Häufige Probleme

### "Login schlägt fehl"

**Lösung 1: Redirect URI prüfen**
```bash
# In .env:
cat .env | grep AZURE_REDIRECT_URI

# Muss EXAKT sein wie in Azure Portal!
# Achten Sie auf: https://, Groß-/Kleinschreibung, Port
```

**Lösung 2: Client Secret abgelaufen?**
```
Azure Portal → App Registrations → Ihre App → Certificates & secrets
→ Prüfen Sie "Expires" Datum
→ Falls abgelaufen: Neuen Secret erstellen + .env aktualisieren
```

### "Emails kommen nicht an"

**Lösung 1: SMTP-Test**
```bash
docker compose -f docker-compose.prod.yml logs backend | grep -i smtp
# Suchen Sie nach Fehlermeldungen
```

**Lösung 2: Firewall**
```bash
# Port 587 erreichbar?
telnet smtp.office365.com 587
# Sollte verbinden (Ctrl+C zum Beenden)
```

**Lösung 3: Passwort falsch**
```bash
# Testen Sie Login im Browser:
# https://outlook.office.com
# Mit SMTP_USER und SMTP_PASS
```

### "Backup schlägt fehl"

**Lösung:**
```bash
# Berechtigungen prüfen
ls -la backups/

# Sollte schreibbar sein
chmod 755 backups/

# Speicherplatz prüfen
df -h
```

---

## 📞 Support

Bei weiteren Fragen:

1. 📖 [INSTALLATION.md](INSTALLATION.md) - Technische Installation
2. 📖 [README.md](README.md) - Projekt-Übersicht
3. 🐛 [GitHub Issues](https://github.com/toda2203/gaderobe/issues) - Fehler melden

---

**Konfiguration abgeschlossen!** 🎉 Das System ist jetzt einsatzbereit.
