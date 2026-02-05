# Gaderobe – Enterprise Workplace Apparel Management System

> Ein skalierbares, unternehmensgerichtetes Verwaltungssystem für Berufsbekleidung mit Microsoft Entra ID Integration, automatisierten Transaktionsprotokollen und intelligenten Bestandsverwaltungsfunktionen.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)]()

---

## 📋 Inhaltsverzeichnis

- [Übersicht](#übersicht)
- [Hauptfunktionalitäten](#hauptfunktionalitäten)
- [Architektur](#architektur)
- [Anforderungen](#anforderungen)
- [Schnellstart](#schnellstart)
- [Deployment](#deployment)
- [API-Dokumentation](#api-dokumentation)
- [Datenbankschema](#datenbankschema)
- [Sicherheit](#sicherheit)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Übersicht

**Gaderobe** ist eine vollständig verwaltete Lösung zur Berufsbekleidungsverwaltung für Unternehmensumgebungen. Das System bietet Echtzeit-Bestandskontrolle, transaktionale Protokollierung, Mitarbeiterverwaltung mit Azure Entra ID Integration und umfassende Auditfunktionen für Compliance und Nachverfolgung.

**Use Cases:**
- Werkstätten, Logistikzentren und Produktionsstätten
- Berufsbekleidungsverteilung und -verwaltung
- Lebenszyklus-Tracking von Bekleidungsartikeln
- Mitarbeiter-Onboarding und -Offboarding mit automatischer Bestandsverwaltung
- Compliance-Berichterstattung und Audit Trails

---

## ✨ Hauptfunktionalitäten

### Bestandsverwaltung
- **Echtzeit-Tracking**: QR-Code-basierte Verfolgung aller Kleidungsstücke
- **Restlaufzeit-Berechnung**: Automatische Warnung bei ablaufender Lebensdauer basierend auf Ausgabedatum
- **Kategorisierung**: Unterstützung für Personalisierte (mitarbeiterspezifisch) und Pool-Artikel
- **Zustandsverwaltung**: Tracking der Zustandshistorie (Neu, Gut, Getragen, Abgebaut)

### Transaktionsmanagement
- **Handover-Protokolle**: Durchgängige Dokumentation von Ausgabe und Rücknahme
- **Digitale Bestätigung**: Email-basierte Bestätigungsworkflows mit Ablaufverfolgung
- **Bulk-Operationen**: Effiziente Massenausgabe und -rücknahme von Artikeln
- **Konditionsassessment**: Detaillierter Zustandsbericht bei jeder Transaktion

### Mitarbeiterverwaltung
- **Azure Entra ID Integration**: Automatische Synchronisierung mit Microsoft 365
- **Rollenbasierte Zugriffskontrolle**: ADMIN, WAREHOUSE, HR, READ_ONLY
- **Automatisches Provisioning**: Neue Mitarbeiter bei nächster Sync automatisch aktiviert
- **Offline-Tracking**: Mitarbeiterdaten auch ohne aktive Entra-Synchronisierung nutzbar

### Administrative Features
- **Automatisierte Backups**: Tägliche/wöchentliche/monatliche Backup-Planung mit Retention Policy
- **Import/Export**: CSV-basierter Datenaustausch mit Bildvalidierung und Force-Overwrite-Modus
- **Stammdaten-Verwaltung**: Konfigurierbare Größen, Kategorien, Abteilungen
- **Audit-Logging**: Vollständiges Änderungsprotokoll für Compliance und Debugging

### Reporting & Analytik
- **Bestandsberichte**: Verfügbarkeit, Zustand, Alterungsanalyse
- **Transaktionsberichte**: Ausgabe-, Rücknahme- und Handover-Statistiken
- **Mitarbeiterbericht**: Zugeordnete Artikel pro Mitarbeiter
- **PDF-Export**: Generierung von Bestandslisten und Transaktionsprotokollen

---

## 🏗️ Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 18)                      │
│  Ant Design Components | Vite | TypeScript | Zustand       │
├─────────────────────────────────────────────────────────────┤
│              HTTPS / CORS / JWT Auth Layer                  │
├─────────────────────────────────────────────────────────────┤
│                  Backend (Node.js/Express)                  │
│  REST API | TypeScript | Helmet | Rate Limiting            │
├─────────────────────────────────────────────────────────────┤
│              Core Services Layer                             │
│  • ClothingItemService    • TransactionService              │
│  • EmployeeService        • ExportService                   │
│  • EntraIdSyncService     • BackupService                   │
│  • EmailService           • MasterDataService               │
├─────────────────────────────────────────────────────────────┤
│                  Prisma ORM                                  │
├─────────────────────────────────────────────────────────────┤
│              SQLite Database                                 │
│  (Production: PostgreSQL recommended)                       │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 18.x |
| **Frontend UI** | Ant Design | 5.x |
| **Frontend Build** | Vite | 5.x |
| **Backend Runtime** | Node.js | 20.x |
| **Backend Framework** | Express | 4.x |
| **Language** | TypeScript | 5.x |
| **Database ORM** | Prisma | 5.x |
| **Database** | SQLite (Dev) / PostgreSQL (Prod) | - |
| **Authentication** | JWT + Microsoft Entra ID | - |
| **Email** | Nodemailer + Office 365 SMTP | - |
| **File Upload** | Multer | 1.4.x |
| **Scheduling** | node-cron | 3.x |
| **PDF Generation** | PDFKit | 0.14.x |
| **Container** | Docker + Docker Compose | Latest |
| **Web Server** | Nginx (Production) | Latest |

---

## 📋 Anforderungen

### Minimal Requirements
- **Docker & Docker Compose** 20.10+
- **Node.js** 20.x (für lokale Entwicklung)
- **PostgreSQL** 14+ (für Production, optional SQLite für Development)
- **Microsoft Entra ID** Tenant (für Authentifizierung)

### System Resources
- **CPU**: 2 Cores minimum
- **RAM**: 2 GB minimum (4 GB recommended)
- **Disk**: 10 GB minimum (für Bestandsverwaltung mit Bildern)
- **Network**: Internetzugang für Azure Entra ID Sync

### Optional aber empfohlen
- **SMTP Server** (Office 365 oder äquivalent für Email-Funktionen)
- **SSL Certificate** (für HTTPS in Production)
- **Backup Storage** (NAS oder Cloud für regelmäßige Backups)

---

## 🚀 Schnellstart

### Lokal (Docker-basiert)

```bash
# Repository klonen
git clone https://github.com/toda2203/Gaderobe.git
cd Gaderobe

# Environment-Datei erstellen und konfigurieren
cp backend/.env.example backend/.env
# Backend/.env anpassen:
# - AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
# - JWT_SECRET
# - SMTP Credentials

# Docker Images bauen
docker build -t bekleidung-backend:latest ./backend
docker build -t bekleidung-frontend:latest ./frontend

# Stack starten
docker compose -f docker-compose.portainer.yml up -d

# Datenbank migrieren
docker exec bekleidung-backend-prod npx prisma migrate deploy

# Admin-User erstellen
docker exec -i bekleidung-backend-prod npx prisma db execute --stdin <<EOF
UPDATE employees SET role = 'ADMIN' WHERE email = 'your-email@example.com';
EOF

# Browser öffnen
# https://localhost:3078
```

### Lokal (Native)

```bash
# Backend starten
cd backend
npm install
npm run build
npm run start
# Server läuft auf https://localhost:3077

# Frontend (in separatem Terminal)
cd frontend
npm install
npm run dev
# Vite Dev Server läuft auf http://localhost:5173
```

---

## 🐳 Deployment

### Production-Deployment auf Linux Server

Siehe [`install.md`](install.md) für vollständige Step-by-Step Anleitung:

```bash
# Phase 1: Server vorbereiten
# Phase 2: Repository klonen
# Phase 3: Dateien hochladen via SCP
# Phase 4: Volumes & SSL Zertifikate erstellen
# Phase 5: Docker Images bauen
# Phase 6: Docker Compose Stack starten
# Phase 7: Admin-User zuweisen & testen
```

**Key Production Features:**
- SSL/TLS Verschlüsselung (self-signed oder Let's Encrypt)
- Automatische Backups (täglich/wöchentlich/monatlich)
- Nginx Reverse Proxy mit Compression
- Health Checks für Container-Überwachung
- Persistente Volumes für Datenbank, Bilder, Backups

---

## 📡 API-Dokumentation

### Base URL
```
https://{HOST}:3077/api
```

### Authentication
Alle Endpoints (außer `/auth` und `/public`) erfordern einen gültigen JWT-Token im Header:
```
Authorization: Bearer {JWT_TOKEN}
```

### Core Endpoints

#### 🔐 Authentication
- `GET /auth/login` – Entra ID Login initiieren
- `GET /auth/callback` – OAuth2 Callback Handler
- `GET /auth/refresh` – Token aktualisieren

#### 👥 Employees
- `GET /employees` – Alle Mitarbeiter abrufen (gefiltert nach Rolle)
- `GET /employees/:id` – Mitarbeiter-Details
- `POST /employees` – Mitarbeiter erstellen (ADMIN only)
- `PATCH /employees/:id` – Mitarbeiter aktualisieren
- `DELETE /employees/:id` – Mitarbeiter deaktivieren

#### 👕 Clothing Items
- `GET /clothing/items` – Alle Kleidungsstücke mit Restlaufzeit
- `GET /clothing/items/:id` – Details und Transaktionshistorie
- `POST /clothing/items` – Kleidungsstück erstellen
- `PATCH /clothing/items/:id` – Update Zustand/Status
- `DELETE /clothing/items/:id` – Kleidungsstück archivieren

#### 📦 Transactions
- `GET /transactions` – Alle Transaktionen (Ausgabe/Rücknahme)
- `POST /transactions/issue` – Einzelne Ausgabe
- `POST /transactions/bulk-issue` – Massenausgabe
- `POST /transactions/:id/return` – Einzelne Rücknahme
- `POST /transactions/bulk-return` – Massenrücknahme
- `GET /transactions/pending` – Ausstehende Rücknahmen

#### 💾 Backup & Export
- `GET /export/backup` – Vollständiger Backup als ZIP
- `POST /export/import` – Backup wiederherstellen
- `POST /export/import?forceOverwrite=true` – Mit Bildvalidierung überschreiben
- `GET /backup-config` – Backup-Konfigurationen abrufen
- `POST /backup-config` – Neue Backup-Planung erstellen

#### 📊 Reports
- `GET /reports/inventory` – Bestandsanalyse
- `GET /reports/transactions` – Transaktionsberichte
- `GET /reports/employees` – Mitarbeiterzuweisungen

### Error Responses

Alle Fehler folgen einheitlichem Format:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR|NOT_FOUND|UNAUTHORIZED|FORBIDDEN|INTERNAL_SERVER_ERROR",
    "message": "Menschenlesbarer Fehlertext",
    "details": {}
  },
  "timestamp": "2026-02-05T12:00:00Z"
}
```

---

## 🗄️ Datenbankschema

### Core Entities

```
employees (Mitarbeiter)
├── id, entraId, email, firstName, lastName
├── department, status, role
└── relationships: transactions, confirmations, personalizedClothing, currentClothing

clothing_types (Kleidungstypen)
├── id, name, category, description
├── availableSizes (JSON), expectedLifespanMonths
├── imageUrl
└── relationships: items, departmentAllocations

clothing_items (Kleidungsstücke)
├── id, internalId, qrCode, typeId, size
├── condition (NEW|GOOD|WORN|RETIRED), category (PERSONALIZED|POOL)
├── status (AVAILABLE|ISSUED|IN_USE|RETURNED|RETIRED|LOST)
├── personalizedForId, currentEmployeeId
└── relationships: transactions, type, personalizedFor, currentEmployee

transactions (Transaktionen)
├── id, employeeId, clothingItemId
├── type (ISSUE|RETURN|TRANSFER)
├── issuedAt, issuedById, conditionOnIssue
├── returnedAt, returnedById, conditionOnReturn
└── relationships: employee, clothingItem, issuedBy, returnedBy

confirmations (Digitale Bestätigungen)
├── id, token, employeeId, protocolType
├── itemsJson (Array), expiresAt
├── emailSent, emailSentAt, confirmed, confirmedAt

audit_logs (Audit-Protokolle)
├── id, entityType, entityId, action
├── changes (JSON), performedById
├── timestamp, ipAddress, userAgent
└── relationships: performedBy (employee)
```

---

## 🔒 Sicherheit

### Implementierte Maßnahmen

✅ **Authentifizierung**
- Microsoft Entra ID / OAuth 2.0
- JWT-basierte Session-Management
- Token Refresh Mechanism
- Secure HTTPS-only Communication

✅ **Authorization**
- Role-Based Access Control (RBAC)
- Operation-Level Permissions (ADMIN, WAREHOUSE, HR, READ_ONLY)
- Data Isolation für READ_ONLY Benutzer

✅ **Input Validation**
- Request Schema Validation (Zod)
- File Type & Size Restrictions
- SQL Injection Prevention (Prisma ORM)

✅ **Infrastructure Security**
- Helmet.js HTTP Headers
- CORS Whitelist Management
- Rate Limiting (500 req/min global, 30/15min auth)
- Input Size Limits (100MB JSON, 50MB files)

✅ **Data Protection**
- Encrypted HTTPS Connections
- Self-signed or CA-signed Certificates
- Database Activity Audit Logging
- Secure File Upload Storage

### Nicht empfohlen für Production ohne Zusatz-Maßnahmen
- SQLite Datenbank (verwende PostgreSQL)
- Self-signed Certificates (verwende Let's Encrypt)
- Default JWT Secret (ändern in .env)
- Email Credentials im Code (verwenden Sie Secrets Management)

---

## 🔧 Troubleshooting

### Container startet nicht
```bash
# Logs prüfen
docker logs bekleidung-backend-prod
docker logs bekleidung-frontend-prod

# Container neu starten
docker compose -f docker-compose.portainer.yml restart

# Volumes prüfen (Permissions)
ls -la /var/lib/docker/volumes/bekleidung_*/
```

### Datenbank-Verbindungsfehler
```bash
# Mehrere DB-Dateien vorhanden?
docker exec bekleidung-backend-prod find /app -name "*.db"

# DATABASE_URL in .env überprüfen
cat /opt/bekleidung/.env | grep DATABASE_URL

# Migrations durchführen
docker exec bekleidung-backend-prod npx prisma migrate deploy
```

### Bilder werden nach Import nicht angezeigt
```bash
# Force Overwrite Mode verwenden
curl -X POST "http://localhost:3077/api/export/import?forceOverwrite=true" \
  -F "file=@backup.zip"

# Oder Bilder manuell validieren
docker exec bekleidung-backend-prod npx prisma db execute --stdin <<EOF
SELECT imageUrl, COUNT(*) FROM clothing_items WHERE imageUrl IS NOT NULL GROUP BY imageUrl;
EOF
```

### Azure Entra ID Sync schlägt fehl
```bash
# AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET überprüfen
echo $AZURE_TENANT_ID
echo $AZURE_CLIENT_ID

# Sync manuell triggern
curl -X POST http://localhost:3077/api/sync/employees \
  -H "Authorization: Bearer {TOKEN}"

# Sync-Status prüfen
curl http://localhost:3077/api/sync/status
```

### Performance-Optimierungen
```bash
# Database Indizes prüfen
docker exec bekleidung-backend-prod npx prisma db seed

# Alte Transaktionen archivieren
docker exec bekleidung-backend-prod sqlite3 /app/data/bekleidung.db \
  "DELETE FROM transactions WHERE returnedAt < datetime('now', '-6 months');"

# Backup-Retention anpassen
# Siehe: /api/backup-config POST body → retentionDays
```

---

## 📝 Lizenz

Proprietary Software – Alle Rechte vorbehalten  
Entwickelt für Demo Zwecke

---

## 👥 Support & Kontakt

Für technische Fragen oder Bug Reports:
- GitHub Issues: [toda2203/Gaderobe/issues](https://github.com/toda2203/Gaderobe/issues)
- Email: daniel@troks.de

---

**Zuletzt aktualisiert:** Februar 2026  
**Status:** Production Ready
