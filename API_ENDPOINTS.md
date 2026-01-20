# 🔌 API Endpoints - Bekleidungsverwaltung

Basis-URL: `http://localhost:3000/api`

## Authentifizierung

Alle geschützten Endpunkte erfordern einen JWT-Token im Authorization-Header:
```
Authorization: Bearer <jwt-token>
```

## Response Format

### Erfolg
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message",
  "timestamp": "2025-12-16T10:30:00Z"
}
```

### Fehler
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message",
    "details": { ... }
  },
  "timestamp": "2025-12-16T10:30:00Z"
}
```

---

## 🔐 Authentication

### Login mit Microsoft Entra ID
```http
GET /auth/login
```
Leitet zum Microsoft Login weiter.

**Response:** Redirect zu Microsoft Entra ID

---

### Callback nach erfolgreicher Authentifizierung
```http
GET /auth/callback?code=<auth-code>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "clx...",
      "email": "max.mustermann@autohaus.de",
      "firstName": "Max",
      "lastName": "Mustermann",
      "department": "Werkstatt",
      "role": "WAREHOUSE"
    }
  }
}
```

---

### Token Refresh
```http
POST /auth/refresh
Authorization: Bearer <refresh-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "new-jwt-token"
  }
}
```

---

### Logout
```http
POST /auth/logout
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Erfolgreich abgemeldet"
}
```

---

### Aktueller Benutzer
```http
GET /auth/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "email": "max.mustermann@autohaus.de",
    "firstName": "Max",
    "lastName": "Mustermann",
    "department": "Werkstatt",
    "role": "WAREHOUSE",
    "status": "ACTIVE"
  }
}
```

---

## 👥 Employees (Mitarbeiter)

### Liste aller Mitarbeiter
```http
GET /employees
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `search` - Suche nach Name, Email
- `department` - Filter nach Abteilung
- `status` - Filter nach Status (ACTIVE, INACTIVE, LEFT)

**Response:**
```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "id": "clx...",
        "firstName": "Max",
        "lastName": "Mustermann",
        "email": "max.mustermann@autohaus.de",
        "department": "Werkstatt",
        "status": "ACTIVE",
        "role": "WAREHOUSE"
      }
    ],
    "pagination": {
      "total": 80,
      "page": 1,
      "limit": 20,
      "totalPages": 4
    }
  }
}
```

---

### Mitarbeiter Details
```http
GET /employees/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "firstName": "Max",
    "lastName": "Mustermann",
    "email": "max.mustermann@autohaus.de",
    "department": "Werkstatt",
    "status": "ACTIVE",
    "role": "WAREHOUSE",
    "currentClothing": [
      {
        "id": "clx...",
        "internalId": "HOSE-001",
        "type": { "name": "Arbeitshose" },
        "size": "48",
        "condition": "GOOD",
        "issuedAt": "2025-01-15T10:00:00Z"
      }
    ],
    "transactionHistory": [...]
  }
}
```

---

### Mitarbeiter aktualisieren (ADMIN only)
```http
PATCH /employees/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "role": "WAREHOUSE",
  "status": "ACTIVE"
}
```

---

### Mitarbeiter synchronisieren (ADMIN only)
```http
POST /employees/sync
Authorization: Bearer <token>
```
Synchronisiert alle Mitarbeiter aus Microsoft Entra ID.

---

## 👕 Clothing Items (Kleidungsstücke)

### Liste aller Kleidungsstücke
```http
GET /clothing/items
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`, `limit`
- `search` - Suche nach internalId, QR-Code
- `typeId` - Filter nach Kleidungstyp
- `category` - PERSONALIZED, POOL
- `status` - AVAILABLE, ISSUED, RETURNED, RETIRED
- `condition` - NEW, GOOD, WORN, RETIRED
- `size` - Größe

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "clx...",
        "internalId": "HOSE-001",
        "type": {
          "id": "clx...",
          "name": "Arbeitshose",
          "category": "Hosen"
        },
        "size": "48",
        "category": "POOL",
        "condition": "GOOD",
        "status": "ISSUED",
        "qrCode": "QR-HOSE-001",
        "imageUrl": "/uploads/clothing/hose-001.jpg",
        "currentEmployee": {
          "firstName": "Max",
          "lastName": "Mustermann"
        }
      }
    ],
    "pagination": { ... }
  }
}
```

---

### Kleidungsstück Details
```http
GET /clothing/items/:id
Authorization: Bearer <token>
```

---

### Kleidungsstück erstellen (WAREHOUSE, ADMIN)
```http
POST /clothing/items
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body (Form Data):**
- `typeId` - ID des Kleidungstyps
- `size` - Größe
- `category` - PERSONALIZED | POOL
- `condition` - NEW | GOOD | WORN
- `isPersonalized` - boolean
- `personalizedForId` - optional, Employee ID
- `purchaseDate` - optional
- `purchasePrice` - optional
- `image` - optional, Bilddatei

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "internalId": "HOSE-042",
    "qrCode": "QR-HOSE-042",
    "imageUrl": "/uploads/clothing/...",
    ...
  }
}
```

---

### Kleidungsstück aktualisieren
```http
PATCH /clothing/items/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "condition": "WORN",
  "status": "AVAILABLE",
  "notes": "Leichte Gebrauchsspuren"
}
```

---

### Kleidungsstück aussortieren
```http
POST /clothing/items/:id/retire
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "reason": "Stark abgenutzt, nicht mehr tragbar"
}
```

---

### QR-Code Suche
```http
GET /clothing/items/qr/:qrCode
Authorization: Bearer <token>
```

**Response:** Kleidungsstück mit dem QR-Code

---

### QR-Code Label drucken
```http
GET /clothing/items/:id/qr-label
Authorization: Bearer <token>
```

**Response:** PDF mit QR-Code Label

---

## 🏷️ Clothing Types (Kleidungstypen)

### Liste aller Typen
```http
GET /clothing/types
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "name": "Arbeitshose",
      "description": "Strapazierfähige Arbeitshose",
      "category": "Hosen",
      "availableSizes": ["42", "44", "46", "48", "50"],
      "expectedLifespanMonths": 24,
      "imageUrl": "/uploads/types/arbeitshose.jpg",
      "isActive": true
    }
  ]
}
```

---

### Typ erstellen (ADMIN)
```http
POST /clothing/types
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Winterjacke",
  "description": "Gefütterte Winterjacke",
  "category": "Jacken",
  "availableSizes": ["S", "M", "L", "XL", "XXL"],
  "expectedLifespanMonths": 36,
  "requiresDepartment": ["Werkstatt", "Service"]
}
```

---

## 🔄 Transactions (Übergaben/Rücknahmen)

### Liste aller Transaktionen
```http
GET /transactions
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`, `limit`
- `employeeId` - Filter nach Mitarbeiter
- `clothingItemId` - Filter nach Kleidungsstück
- `type` - ISSUE, RETURN, TRANSFER
- `dateFrom`, `dateTo` - Zeitraum

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "clx...",
        "type": "ISSUE",
        "employee": {
          "firstName": "Max",
          "lastName": "Mustermann"
        },
        "clothingItem": {
          "internalId": "HOSE-001",
          "type": { "name": "Arbeitshose" }
        },
        "issuedAt": "2025-01-15T10:00:00Z",
        "issuedBy": {
          "firstName": "Anna",
          "lastName": "Schmidt"
        },
        "conditionOnIssue": "GOOD",
        "signatureUrl": "/uploads/signatures/...",
        "returnedAt": null
      }
    ],
    "pagination": { ... }
  }
}
```

---

### Kleidung ausgeben
```http
POST /transactions/issue
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body (Form Data):**
- `employeeId` - ID des Empfängers
- `clothingItemIds` - Array von Kleidungsstück-IDs
- `conditionOnIssue` - NEW | GOOD | WORN
- `notes` - optional
- `signature` - Bilddatei (digitale Unterschrift)

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "clx...",
        "clothingItem": { ... },
        "issuedAt": "2025-12-16T10:30:00Z"
      }
    ]
  }
}
```

---

### Kleidung zurücknehmen
```http
POST /transactions/:id/return
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "conditionOnReturn": "WORN",
  "notes": "Leichte Gebrauchsspuren"
}
```

---

### Transaktion Details
```http
GET /transactions/:id
Authorization: Bearer <token>
```

---

### Historie eines Mitarbeiters
```http
GET /transactions/employee/:employeeId/history
Authorization: Bearer <token>
```

---

### Historie eines Kleidungsstücks
```http
GET /transactions/clothing/:clothingItemId/history
Authorization: Bearer <token>
```

---

## 📊 Reports (Auswertungen)

### Dashboard Übersicht
```http
GET /reports/dashboard
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEmployees": 80,
    "activeEmployees": 75,
    "totalClothingItems": 500,
    "itemsByStatus": {
      "AVAILABLE": 120,
      "ISSUED": 350,
      "RETIRED": 30
    },
    "itemsByCategory": {
      "PERSONALIZED": 200,
      "POOL": 300
    },
    "recentTransactions": [ ... ],
    "pendingReturns": [ ... ]
  }
}
```

---

### Bestandsübersicht
```http
GET /reports/inventory
Authorization: Bearer <token>
```

**Query Parameters:**
- `department` - Filter nach Abteilung
- `type` - Filter nach Kleidungstyp

---

### Offene Rückgaben
```http
GET /reports/pending-returns
Authorization: Bearer <token>
```

**Query Parameters:**
- `daysOverdue` - Mindest-Tage seit Ausgabe

---

### Ausgaben pro Abteilung
```http
GET /reports/by-department
Authorization: Bearer <token>
```

---

### Export als CSV
```http
GET /reports/export/csv
Authorization: Bearer <token>
```

**Query Parameters:**
- `type` - inventory, transactions, employees
- `dateFrom`, `dateTo`

**Response:** CSV-Datei

---

### Export als PDF
```http
GET /reports/export/pdf
Authorization: Bearer <token>
```

**Query Parameters:**
- `type` - inventory, transactions
- `dateFrom`, `dateTo`

**Response:** PDF-Datei

---

## 🏥 Health & System

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-16T10:30:00Z",
  "uptime": 3600,
  "database": "connected",
  "version": "1.0.0"
}
```

---

### System Info (ADMIN only)
```http
GET /health/info
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "nodeVersion": "20.10.0",
    "databaseSize": "15.2 MB",
    "uploadsSize": "245 MB",
    "lastBackup": "2025-12-16T00:00:00Z"
  }
}
```

---

## Error Codes

| Code | HTTP Status | Beschreibung |
|------|-------------|--------------|
| `UNAUTHORIZED` | 401 | Nicht authentifiziert |
| `FORBIDDEN` | 403 | Keine Berechtigung |
| `NOT_FOUND` | 404 | Ressource nicht gefunden |
| `VALIDATION_ERROR` | 400 | Validierungsfehler |
| `DUPLICATE_ENTRY` | 409 | Eintrag existiert bereits |
| `CLOTHING_NOT_FOUND` | 404 | Kleidungsstück nicht gefunden |
| `EMPLOYEE_NOT_FOUND` | 404 | Mitarbeiter nicht gefunden |
| `CLOTHING_NOT_AVAILABLE` | 400 | Kleidungsstück nicht verfügbar |
| `ALREADY_ISSUED` | 400 | Bereits ausgegeben |
| `NOT_ISSUED` | 400 | Nicht ausgegeben |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate Limit überschritten |
| `INTERNAL_SERVER_ERROR` | 500 | Interner Serverfehler |

---

## Pagination

Alle Listen-Endpunkte unterstützen Pagination:

**Query Parameters:**
- `page` - Seitennummer (default: 1)
- `limit` - Einträge pro Seite (default: 20, max: 100)

**Response:**
```json
{
  "data": [ ... ],
  "pagination": {
    "total": 500,
    "page": 1,
    "limit": 20,
    "totalPages": 25,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Rate Limiting

- **Standard Endpunkte**: 100 Anfragen / 15 Minuten
- **Auth Endpunkte**: 5 Anfragen / 15 Minuten

Bei Überschreitung: HTTP 429 mit `RATE_LIMIT_EXCEEDED`
