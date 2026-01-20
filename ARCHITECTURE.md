# 🏗️ Architekturübersicht - Bekleidungsverwaltung

## Gesamtarchitektur

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Container                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Frontend (React + TypeScript)           │  │
│  │  • Material-UI / Ant Design                          │  │
│  │  • React Router                                      │  │
│  │  • QR-Scanner Integration                            │  │
│  │  • Signature Pad                                     │  │
│  │  • Responsive Layout (Desktop/Tablet/Mobile)         │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓ HTTPS                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Backend (Node.js + Express)                │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Authentication Middleware                     │  │  │
│  │  │  • Microsoft Entra ID (OAuth 2.0/OIDC)        │  │  │
│  │  │  • JWT Token Validation                        │  │  │
│  │  │  • Role-based Access Control                   │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  API Layer (REST)                              │  │  │
│  │  │  • /api/auth/*                                 │  │  │
│  │  │  • /api/employees/*                            │  │  │
│  │  │  • /api/clothing/*                             │  │  │
│  │  │  • /api/transactions/*                         │  │  │
│  │  │  • /api/reports/*                              │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Business Logic Layer                          │  │  │
│  │  │  • EmployeeService                             │  │  │
│  │  │  • ClothingService                             │  │  │
│  │  │  • TransactionService                          │  │  │
│  │  │  • ReportService                               │  │  │
│  │  │  • AuditService                                │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Data Access Layer (Repository Pattern)        │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SQLite Database                         │  │
│  │  • /data/bekleidung.db (persistent volume)          │  │
│  │  • Migrations mit TypeORM/Prisma                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Datei-Storage                           │  │
│  │  • /uploads/clothing-images/                         │  │
│  │  • /uploads/signatures/                              │  │
│  │  • /temp/exports/ (CSV, PDF)                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↑
                  Microsoft Entra ID
                  (OAuth 2.0 / OIDC)
```

## Technologie-Stack

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js 4.x
- **Language**: TypeScript 5.x
- **ORM**: Prisma 5.x (bessere TypeScript-Integration als TypeORM)
- **Authentication**: 
  - `@azure/msal-node` (Microsoft Authentication Library)
  - `passport-azure-ad`
- **Validation**: Zod / Joi
- **QR-Code**: `qrcode` (Generierung)
- **PDF**: `pdfkit` oder `puppeteer`
- **Logging**: `winston`
- **Testing**: Jest + Supertest

### Frontend
- **Framework**: React 18.x
- **Language**: TypeScript 5.x
- **UI Library**: Ant Design (empfohlen für Business-Apps)
- **State Management**: Zustand oder React Context
- **Routing**: React Router 6.x
- **HTTP Client**: Axios
- **QR Scanner**: `html5-qrcode`
- **Signature**: `react-signature-canvas`
- **Forms**: React Hook Form + Zod
- **Testing**: Vitest + React Testing Library

### Database
- **DBMS**: SQLite 3.x
- **Migration Tool**: Prisma Migrate
- **Backup**: Shell-Scripts + Cron

### DevOps
- **Container**: Docker + Docker Compose
- **Reverse Proxy**: Nginx (optional, für HTTPS)
- **Environment**: `.env` files (nicht in Git)

## Sicherheitskonzept

### Authentication Flow
```
1. User → Frontend → Login-Button
2. Frontend → Redirect → Microsoft Entra ID Login
3. User authentifiziert sich
4. Entra ID → Redirect mit Auth Code → Frontend
5. Frontend → POST /api/auth/callback (mit Code)
6. Backend → Exchange Code → Access Token (Entra ID)
7. Backend → Fetch User Profile (Name, Email, Department)
8. Backend → Erstelle/Update User in DB
9. Backend → Erstelle JWT Token (für App-interne Auth)
10. Backend → Response mit JWT + User Info
11. Frontend → Speichere JWT in Memory/SessionStorage
12. Frontend → Alle API-Calls mit Bearer Token
```

### Authorization (RBAC)
- **Admin**: Volle Rechte
- **Lager**: Kleidung verwalten, ausgeben, zurücknehmen
- **HR**: Lesen, Reports, keine Änderungen
- **Read-Only**: Nur Ansicht

### Datenschutz
- Keine Passwörter in eigener DB
- HTTPS/TLS für alle Verbindungen
- JWT mit kurzer Lebensdauer (1h) + Refresh Token
- Audit-Log für alle Änderungen

## Datenpersistenz

### Docker Volumes
```yaml
volumes:
  - ./data:/app/data                    # SQLite DB
  - ./uploads:/app/uploads              # Bilder, Signaturen
  - ./backups:/app/backups              # Automatische Backups
  - ./logs:/app/logs                    # Application Logs
```

### Backup-Strategie
- **Täglich**: Automatisches SQLite-Backup (VACUUM INTO)
- **Wöchentlich**: Full-Backup mit Uploads
- **Retention**: 30 Tage
- **Location**: `/backups` (Volume gemappt auf Host)

## API-Design Prinzipien

### REST Conventions
- **GET**: Lesen (keine Änderungen)
- **POST**: Erstellen
- **PUT**: Vollständige Aktualisierung
- **PATCH**: Teilweise Aktualisierung
- **DELETE**: Löschen (soft-delete bevorzugt)

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message",
  "timestamp": "2025-12-16T10:30:00Z"
}
```

### Error Format
```json
{
  "success": false,
  "error": {
    "code": "CLOTHING_NOT_FOUND",
    "message": "Kleidungsstück nicht gefunden",
    "details": { ... }
  },
  "timestamp": "2025-12-16T10:30:00Z"
}
```

## Erweiterbarkeit

### Vorbereitet für
1. **Multi-Mandant**: Schema-Erweiterung um `locationId`
2. **Mehrsprachigkeit**: i18n-Layer im Frontend
3. **REST-API für Dritte**: API-Key Authentication
4. **Benachrichtigungen**: Email/Push-Service abstrahiert
5. **Erweiterte Reports**: Separater Report-Service

### Plugin-System (zukünftig)
```typescript
interface PluginInterface {
  name: string;
  version: string;
  init(): Promise<void>;
  onEmployeeCreated?(employee: Employee): Promise<void>;
  onClothingIssued?(transaction: Transaction): Promise<void>;
}
```

## Performance-Überlegungen

- **Paginierung**: Alle Listen mit Limit/Offset
- **Caching**: Redis (optional) für häufige Abfragen
- **Indizes**: Auf häufig gesuchten Feldern
- **Lazy Loading**: Bilder erst bei Bedarf laden
- **Kompression**: Gzip für API-Responses

## Monitoring & Logging

- **Application Logs**: Winston → Datei + Console
- **Access Logs**: Morgan (Express)
- **Error Tracking**: Sentry (optional)
- **Health Check**: `/api/health` Endpoint
- **Metrics**: Prometheus-kompatibel (optional)
