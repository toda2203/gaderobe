# Garderobe - Bekleidungsverwaltungssystem

**Professionelles Verwaltungssystem für Arbeitskleidung und Schutzausrüstung**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/toda2203/gaderobe)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](docker-compose.prod.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-18.2-blue.svg)](https://reactjs.org/)

---

## 📋 Übersicht

Das Garderobe-System ist eine moderne Full-Stack-Webanwendung zur Verwaltung von Arbeitskleidung und Schutzausrüstung in Unternehmen. Die Lösung bietet vollständige Nachverfolgung von Ausgaben, Rückgaben, Bestände und automatische Protokollierung aller Transaktionen.

### ✨ Hauptfunktionen

- **👥 Mitarbeiterverwaltung** - Integration mit Microsoft Entra ID (Azure AD)
- **👔 Bekleidungsverwaltung** - Typen, Größen, Bilder, Lagerbestände
- **📦 Transaktionsverwaltung** - Ausgaben und Rückgaben mit PDF-Protokollen
- **📊 Berichte & Analytics** - Detaillierte Auswertungen und Statistiken
- **✉️ Email-Bestätigungen** - Automatische Benachrichtigungen per SMTP
- **🔒 Sicherheit** - OAuth2, JWT-Token, Audit-Logging
- **💾 Automatische Backups** - Konfigurierbare Zeitpläne mit Retention
- **📱 Responsive Design** - Tablet-optimierte Benutzeroberfläche
- **🐳 Docker-Ready** - One-Command Installation

---

## 🚀 Quick Start

### Voraussetzungen

- **Server**: Debian 11+, Ubuntu 20.04+, oder kompatible Linux-Distribution
- **RAM**: 2 GB minimum (4 GB empfohlen)
- **Disk**: 20 GB freier Speicherplatz
- **Docker**: Wird automatisch installiert, falls nicht vorhanden
- **Accounts**: Microsoft Entra ID, SMTP-Email

### Installation (Ein Befehl!)

```bash
git clone https://github.com/toda2203/gaderobe.git
cd gaderobe
chmod +x deployment/*.sh
sudo ./deployment/setup.sh
```

Das Setup-Skript führt Sie durch:
1. ✅ Docker-Installation (automatisch)
2. ✅ Konfiguration (Firmenname, Domain, Ports)
3. ✅ SSL-Zertifikat-Generierung
4. ✅ Deployment der Container
5. ✅ Zugriffs-URLs und nächste Schritte

**Fertig!** Öffnen Sie `https://ihr-server:3078` im Browser.
- 2 GB freier Festplattenspeicher

### Installation

```powershell
# 1. Repository klonen
git clone https://github.com/your-org/bekleidung.git
cd bekleidung

# 2. Environment-Dateien erstellen
Copy-Item .env.example .env

# 3. .env bearbeiten (Azure AD Credentials eintragen)
notepad .env

# 4. Anwendung starten
docker-compose up -d

# 5. Browser öffnen
Start-Process http://localhost
```

**🎉 Fertig!** Die Anwendung läuft auf http://localhost

Detaillierte Anleitung: [SETUP.md](SETUP.md)

---

## 📚 Dokumentation

| Dokument | Beschreibung |
|----------|--------------|
| [SETUP.md](SETUP.md) | Installation & Deployment Guide |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Architektur & Technologie-Stack |
| [DATABASE_MODEL.md](DATABASE_MODEL.md) | Datenbankmodell & Schema |
| [API_ENDPOINTS.md](API_ENDPOINTS.md) | REST API Dokumentation |
| [UI_STRUCTURE.md](UI_STRUCTURE.md) | UI-Screens & Design System |
| [ERWEITERUNGEN.md](ERWEITERUNGEN.md) | Roadmap & Feature-Ideen |

---

## 🏗️ Technologie-Stack

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** Express.js
- **Language:** TypeScript 5
- **Database:** SQLite (Prisma ORM)
- **Auth:** Microsoft Entra ID (OAuth 2.0)

### Frontend
- **Framework:** React 18
- **UI Library:** Ant Design
- **Language:** TypeScript 5
- **State:** Zustand
- **Build:** Vite

### Infrastructure
- **Container:** Docker & Docker Compose
- **Reverse Proxy:** Nginx
- **Backup:** Automatisch (täglich)

---

## 📂 Projektstruktur

```
bekleidung/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── config/         # Konfiguration
│   │   ├── controllers/    # Request Handler
│   │   ├── services/       # Business Logic
│   │   ├── repositories/   # Data Access
│   │   ├── middleware/     # Auth, Validation, etc.
│   │   ├── routes/         # API Routes
│   │   └── utils/          # Helpers
│   ├── prisma/
│   │   └── schema.prisma   # Datenbankmodell
│   ├── Dockerfile
│   └── package.json
│
├── frontend/               # React SPA
│   ├── src/
│   │   ├── components/     # UI-Komponenten
│   │   ├── pages/          # Seiten/Views
│   │   ├── services/       # API-Clients
│   │   ├── store/          # State Management
│   │   ├── types/          # TypeScript Types
│   │   └── utils/          # Helpers
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── data/                   # SQLite Database (persistent)
├── uploads/                # Bilder, Signaturen
├── backups/                # Automatische Backups
├── logs/                   # Application Logs
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🔐 Sicherheit

- ✅ Microsoft Entra ID Single Sign-On
- ✅ JWT Token-basierte Authentifizierung
- ✅ Rollenbasierte Zugriffskontrolle (RBAC)
- ✅ HTTPS/TLS in Produktion
- ✅ Rate Limiting
- ✅ Audit Logs für alle Änderungen
- ✅ Input Validation & Sanitization

---

## 👥 Rollen & Berechtigungen

| Rolle | Berechtigungen |
|-------|---------------|
| **ADMIN** | Vollzugriff: Kleidung, Mitarbeiter, Einstellungen |
| **WAREHOUSE** | Kleidung verwalten, ausgeben, zurücknehmen |
| **HR** | Lesen, Reports erstellen, keine Änderungen |
| **READ_ONLY** | Nur Ansicht, keine Änderungen |

---

## 📊 Features

### ✅ Mitarbeiterverwaltung
- Automatischer Import aus Microsoft Entra ID
- Abteilungszuordnung
- Aktuelle Kleidung pro Mitarbeiter
- Vollständige Historie

### ✅ Kleidungsverwaltung
- Personalisierte Kleidung (mit Namen bestickt)
- Poolkleidung (mehrfach ausgebbar)
- QR-Code für jedes Stück
- Zustandsverwaltung (Neu, Gut, Abgenutzt, Ausgesondert)
- Bild-Upload

### ✅ Übergabe & Rücknahme
- QR-Scanner für schnelle Erfassung
- Digitale Unterschrift
- Batch-Übergabe (mehrere Items gleichzeitig)
- Zustandsbewertung
- Notizen & Kommentare

### ✅ Reports & Auswertungen
- Dashboard mit Kennzahlen
- Bestandsübersicht
- Offene Rückgaben
- Ausgaben pro Abteilung
- Export als CSV/PDF

### ✅ Backup & Wiederherstellung
- Automatisches tägliches Backup aller Daten
- Einmalige ZIP-Import-Funktion zum Wiederherstellen
- **Automatische Bildvalidierung** nach Import
- Benutzerstatus (Rollen, Sichtbarkeit) werden gespeichert
- Protokolle und digitale Unterschriften enthalten

### ✅ QR-Codes & Etiketten
- Automatische QR-Code Generierung
- Druckbare Labels
- Scanner-Integration (Mobile)

---

## 🖼️ Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Kleidungsverwaltung
![Kleidung](docs/screenshots/clothing.png)

### Übergabe
![Übergabe](docs/screenshots/transaction.png)

*Screenshots werden nach erstem Deployment hinzugefügt*

---

## 🔧 Entwicklung

### Lokale Entwicklung (ohne Docker)

#### Backend
```powershell
cd backend
npm install
Copy-Item .env.example .env
# .env bearbeiten
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Backend läuft auf: http://localhost:3000

#### Frontend
```powershell
cd frontend
npm install
Copy-Item .env.example .env
# .env bearbeiten
npm run dev
```

Frontend läuft auf: http://localhost:5173

### Testing
```powershell
# Backend Tests
cd backend
npm test
npm run test:coverage

# Frontend Tests
cd frontend
npm test
```

### Linting & Formatting
```powershell
# Backend
cd backend
npm run lint
npm run format

# Frontend
cd frontend
npm run lint
npm run format
```

---

## 🐳 Docker

### Build & Run
```powershell
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d --build

# Logs ansehen
docker-compose logs -f

# Container stoppen
docker-compose down
```

### Container Management
```powershell
# Backend Shell
docker exec -it bekleidung-backend sh

# Datenbank öffnen
docker exec -it bekleidung-backend sqlite3 /app/data/bekleidung.db

# Backup erstellen
docker exec bekleidung-backend sh /app/scripts/backup.sh
```

---

## 🔄 Updates & Wartung

### Anwendung aktualisieren
```powershell
docker-compose down
git pull
docker-compose up -d --build
```

### Datenbank migrieren
```powershell
docker exec -it bekleidung-backend npx prisma migrate deploy
```

### Backup & Restore
```powershell
# Backup via Web-UI erstellen
1. Gehe zu Einstellungen → Sicherung
2. Klicke "Komplettes Backup erstellen (.zip)"
3. ZIP-Datei wird heruntergeladen

# Backup via Kommandozeile
docker exec bekleidung-backend sh /app/scripts/backup.sh

# Restore via Web-UI
1. Gehe zu Einstellungen → Sicherung
2. Klicke "ZIP-Backup importieren"
3. Wähle die ZIP-Datei aus
4. **Automatisch: Bilder werden validiert!**
5. Report zeigt Validierungsergebnis

# Restore via Kommandozeile
docker exec bekleidung-backend sh /app/scripts/restore.sh /path/to/backup.zip
```

---

## 🐛 Troubleshooting

### Häufige Probleme

#### Problem: Login funktioniert nicht
```powershell
# Logs prüfen
docker-compose logs backend

# Azure AD Konfiguration prüfen
# - Redirect URI korrekt?
# - Client Secret gültig?
```

#### Problem: Datenbank locked
```powershell
# Container neu starten
docker-compose restart backend
```

#### Problem: Uploads nicht sichtbar
```powershell
# Berechtigungen prüfen
icacls .\uploads
```

Weitere Hilfe: [SETUP.md - Troubleshooting](SETUP.md#troubleshooting)

---

## 📈 Performance

### Empfohlene Systemanforderungen

**Minimum:**
- 2 CPU Cores
- 2 GB RAM
- 10 GB Festplatte

**Empfohlen:**
- 4 CPU Cores
- 4 GB RAM
- 50 GB Festplatte (inkl. Uploads & Backups)

### Skalierung
- ✅ Bis 200 Mitarbeiter: SQLite ausreichend
- ✅ Bis 1000 Kleidungsstücke: Single-Server
- ⚠️ Mehr als 200 MA: PostgreSQL empfohlen
- ⚠️ Mehr als 5 Standorte: Multi-Tenancy Architektur

---

## 🛣️ Roadmap

### ✅ Phase 1: MVP (Fertig)
- Basis-Funktionalität
- Microsoft Entra ID Integration
- QR-Codes
- Basis-Reports

### 🚧 Phase 2: Optimierungen (Q1 2026)
- [ ] Benachrichtigungen
- [ ] Erweiterte Reports
- [ ] Bildverwaltung verbessern
- [ ] Mobile App (PWA)

### 📋 Phase 3: Erweiterungen (Q2 2026)
- [ ] Multi-Standort Support
- [ ] Mehrsprachigkeit
- [ ] Kosten-Tracking
- [ ] Automatisierungen

Vollständige Roadmap: [ERWEITERUNGEN.md](ERWEITERUNGEN.md)

---

## 🤝 Contributing

Dieses Projekt ist für den internen Gebrauch bestimmt. Änderungen sollten über Pull Requests eingereicht werden:

1. Fork erstellen
2. Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Pull Request erstellen

---

## 📄 Lizenz

**UNLICENSED** - Dieses Projekt ist für den internen Gebrauch im Autohaus bestimmt. Alle Rechte vorbehalten.

---

## 👨‍💻 Support

Bei Fragen oder Problemen:

1. Dokumentation durchlesen
2. Logs prüfen: `docker-compose logs`
3. Issue erstellen (GitHub/GitLab)
4. IT-Support kontaktieren

---

## 🙏 Danksagungen

Entwickelt mit:
- [Node.js](https://nodejs.org/)
- [React](https://reactjs.org/)
- [Ant Design](https://ant.design/)
- [Prisma](https://www.prisma.io/)
- [TypeScript](https://www.typescriptlang.org/)
- [Docker](https://www.docker.com/)

---

**Made with ❤️ for [Autohaus Name]**

*Letzte Aktualisierung: 20. Januar 2026*
