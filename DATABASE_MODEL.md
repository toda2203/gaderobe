# 🗄️ Datenbankmodell - Bekleidungsverwaltung

## Entity-Relationship Diagram

```
┌─────────────────────┐
│     Employee        │
├─────────────────────┤
│ id (PK)             │
│ entraId (unique)    │───┐
│ email (unique)      │   │
│ firstName           │   │
│ lastName            │   │
│ department          │   │
│ status              │   │
│ role                │   │
│ lastSyncAt          │   │
│ createdAt           │   │
│ updatedAt           │   │
└─────────────────────┘   │
                          │
                          │ 1:N
                          │
                          ↓
┌─────────────────────────────────┐
│      Transaction                │
├─────────────────────────────────┤
│ id (PK)                         │
│ employeeId (FK) ────────────────┘
│ clothingItemId (FK) ────────────┐
│ type                            │
│ issuedAt                        │
│ issuedBy (FK → Employee)        │
│ returnedAt                      │
│ returnedBy (FK → Employee)      │
│ conditionOnIssue                │
│ conditionOnReturn               │
│ signatureUrl                    │
│ notes                           │
│ createdAt                       │
│ updatedAt                       │
└─────────────────────────────────┘
                          │
                          │ N:1
                          │
                          ↓
┌─────────────────────────────────┐
│      ClothingItem               │
├─────────────────────────────────┤
│ id (PK)                         │
│ internalId (unique, readable)   │
│ typeId (FK) ────────────────────┐
│ size                            │
│ category                        │
│ condition                       │
│ imageUrl                        │
│ qrCode (unique)                 │
│ isPersonalized                  │
│ personalizedFor (FK→Employee)   │
│ currentEmployeeId (FK)          │
│ status                          │
│ purchaseDate                    │
│ purchasePrice                   │
│ retirementDate                  │
│ retirementReason                │
│ createdAt                       │
│ updatedAt                       │
└─────────────────────────────────┘
                          │
                          │ N:1
                          │
                          ↓
┌─────────────────────────────────┐
│      ClothingType               │
├─────────────────────────────────┤
│ id (PK)                         │
│ name (unique)                   │
│ description                     │
│ category                        │
│ availableSizes                  │
│ expectedLifespanMonths          │
│ requiresDepartment              │
│ imageUrl                        │
│ isActive                        │
│ createdAt                       │
│ updatedAt                       │
└─────────────────────────────────┘


┌─────────────────────────────────┐
│      AuditLog                   │
├─────────────────────────────────┤
│ id (PK)                         │
│ entityType                      │
│ entityId                        │
│ action                          │
│ performedBy (FK → Employee)     │
│ changes (JSON)                  │
│ ipAddress                       │
│ userAgent                       │
│ timestamp                       │
└─────────────────────────────────┘


┌─────────────────────────────────┐
│      DepartmentAllocation       │
├─────────────────────────────────┤
│ id (PK)                         │
│ department                      │
│ clothingTypeId (FK)             │
│ quantity                        │
│ mandatory                       │
│ renewalIntervalMonths           │
│ createdAt                       │
│ updatedAt                       │
└─────────────────────────────────┘
```

## Tabellendefinitionen (Prisma Schema)

### Employee (Mitarbeiter)
```prisma
model Employee {
  id              String    @id @default(cuid())
  entraId         String    @unique  // Microsoft Entra ID
  email           String    @unique
  firstName       String
  lastName        String
  department      String?
  status          EmployeeStatus @default(ACTIVE)
  role            UserRole  @default(READ_ONLY)
  lastSyncAt      DateTime  @updatedAt
  
  // Relations
  issuedTransactions     Transaction[] @relation("IssuedBy")
  returnedTransactions   Transaction[] @relation("ReturnedBy")
  transactions           Transaction[] @relation("EmployeeTransactions")
  personalizedClothing   ClothingItem[] @relation("PersonalizedFor")
  currentClothing        ClothingItem[] @relation("CurrentEmployee")
  auditLogs              AuditLog[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([entraId])
  @@index([email])
  @@index([department])
  @@index([status])
  @@map("employees")
}

enum EmployeeStatus {
  ACTIVE
  INACTIVE
  LEFT
}

enum UserRole {
  ADMIN
  WAREHOUSE
  HR
  READ_ONLY
}
```

### ClothingItem (Kleidungsstück)
```prisma
model ClothingItem {
  id                  String    @id @default(cuid())
  internalId          String    @unique  // Z.B. "HOSE-001"
  typeId              String
  type                ClothingType @relation(fields: [typeId], references: [id])
  
  size                String
  category            ClothingCategory
  condition           ClothingCondition @default(NEW)
  
  imageUrl            String?
  qrCode              String    @unique
  
  isPersonalized      Boolean   @default(false)
  personalizedForId   String?
  personalizedFor     Employee? @relation("PersonalizedFor", fields: [personalizedForId], references: [id])
  
  currentEmployeeId   String?
  currentEmployee     Employee? @relation("CurrentEmployee", fields: [currentEmployeeId], references: [id])
  
  status              ClothingStatus @default(AVAILABLE)
  
  purchaseDate        DateTime?
  purchasePrice       Decimal?  @db.Decimal(10, 2)
  
  retirementDate      DateTime?
  retirementReason    String?
  
  // Relations
  transactions        Transaction[]
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  @@index([internalId])
  @@index([qrCode])
  @@index([typeId])
  @@index([category])
  @@index([status])
  @@index([currentEmployeeId])
  @@map("clothing_items")
}

enum ClothingCategory {
  PERSONALIZED      // Mit Namen bestickt
  POOL             // Poolkleidung
}

enum ClothingCondition {
  NEW              // Neu
  GOOD             // Gut
  WORN             // Abgenutzt
  RETIRED          // Ausgesondert
}

enum ClothingStatus {
  AVAILABLE        // Verfügbar
  ISSUED           // Ausgegeben
  IN_USE           // In Benutzung
  RETURNED         // Zurückgegeben
  RETIRED          // Ausgesondert
  LOST             // Verloren
}
```

### ClothingType (Kleidungstyp)
```prisma
model ClothingType {
  id                      String    @id @default(cuid())
  name                    String    @unique  // "Arbeitshose", "Poloshirt"
  description             String?
  category                String    // "Oberbekleidung", "Unterbekleidung", "Schuhe"
  
  availableSizes          String[]  // ["XS", "S", "M", "L", "XL", "XXL"]
  expectedLifespanMonths  Int?      // Erwartete Lebensdauer
  
  requiresDepartment      String[]  // Nur für bestimmte Abteilungen
  
  imageUrl                String?
  isActive                Boolean   @default(true)
  
  // Relations
  items                   ClothingItem[]
  departmentAllocations   DepartmentAllocation[]
  
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  
  @@index([name])
  @@index([isActive])
  @@map("clothing_types")
}
```

### Transaction (Übergabe/Rücknahme)
```prisma
model Transaction {
  id                  String    @id @default(cuid())
  
  employeeId          String
  employee            Employee  @relation("EmployeeTransactions", fields: [employeeId], references: [id])
  
  clothingItemId      String
  clothingItem        ClothingItem @relation(fields: [clothingItemId], references: [id])
  
  type                TransactionType
  
  // Übergabe
  issuedAt            DateTime  @default(now())
  issuedById          String
  issuedBy            Employee  @relation("IssuedBy", fields: [issuedById], references: [id])
  conditionOnIssue    ClothingCondition
  
  // Rücknahme
  returnedAt          DateTime?
  returnedById        String?
  returnedBy          Employee? @relation("ReturnedBy", fields: [returnedById], references: [id])
  conditionOnReturn   ClothingCondition?
  
  signatureUrl        String?   // Pfad zur digitalen Unterschrift
  notes               String?
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  @@index([employeeId])
  @@index([clothingItemId])
  @@index([issuedAt])
  @@index([returnedAt])
  @@index([type])
  @@map("transactions")
}

enum TransactionType {
  ISSUE       // Ausgabe
  RETURN      // Rücknahme
  TRANSFER    // Weitergabe (optional)
}
```

### AuditLog (Änderungsprotokoll)
```prisma
model AuditLog {
  id              String    @id @default(cuid())
  
  entityType      String    // "Employee", "ClothingItem", "Transaction"
  entityId        String    // ID des geänderten Objekts
  action          AuditAction
  
  performedById   String
  performedBy     Employee  @relation(fields: [performedById], references: [id])
  
  changes         Json?     // Vorher/Nachher als JSON
  
  ipAddress       String?
  userAgent       String?
  
  timestamp       DateTime  @default(now())
  
  @@index([entityType, entityId])
  @@index([performedById])
  @@index([timestamp])
  @@map("audit_logs")
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  ISSUE
  RETURN
  RETIRE
}
```

### DepartmentAllocation (Abteilungszuordnung)
```prisma
model DepartmentAllocation {
  id                      String    @id @default(cuid())
  
  department              String
  clothingTypeId          String
  clothingType            ClothingType @relation(fields: [clothingTypeId], references: [id])
  
  quantity                Int       // Anzahl pro Mitarbeiter
  mandatory               Boolean   @default(false)
  renewalIntervalMonths   Int?      // Erneuerungsintervall
  
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  
  @@unique([department, clothingTypeId])
  @@index([department])
  @@map("department_allocations")
}
```

## Indizes & Performance

### Wichtige Indizes
- `Employee`: entraId, email, department, status
- `ClothingItem`: internalId, qrCode, typeId, status, currentEmployeeId
- `Transaction`: employeeId, clothingItemId, issuedAt, returnedAt
- `AuditLog`: entityType+entityId, performedById, timestamp

### Composite Indizes (bei Bedarf)
```prisma
@@index([status, category])           // ClothingItem
@@index([department, status])          // Employee
@@index([employeeId, issuedAt])       // Transaction
```

## Datenintegrität

### Constraints
- **Unique**: entraId, email, internalId, qrCode
- **Foreign Keys**: Alle Relationen mit onDelete-Strategie
- **Not Null**: Alle kritischen Felder (id, timestamps, status)

### Soft Delete
```prisma
model ClothingItem {
  // ...
  deletedAt DateTime?
  
  @@index([deletedAt])
}
```

### Cascading
```prisma
clothingType ClothingType @relation(fields: [typeId], references: [id], onDelete: Restrict)
employee     Employee     @relation(fields: [employeeId], references: [id], onDelete: Restrict)
```

## Datenmigration

### Initial Seeds
```typescript
// prisma/seeds/initial.ts
const clothingTypes = [
  { name: "Arbeitshose", category: "Hosen", sizes: ["42", "44", "46", "48"] },
  { name: "Poloshirt", category: "Shirts", sizes: ["S", "M", "L", "XL"] },
  { name: "Winterjacke", category: "Jacken", sizes: ["S", "M", "L", "XL"] },
  { name: "Sicherheitsschuhe", category: "Schuhe", sizes: ["39", "40", "41", "42", "43"] },
];

const departments = [
  "Verwaltung",
  "Werkstatt",
  "Verkauf",
  "Service",
  "Lager"
];
```

## Abfrage-Beispiele

### Aktuelle Kleidung eines Mitarbeiters
```typescript
const employeeClothing = await prisma.clothingItem.findMany({
  where: {
    currentEmployeeId: employeeId,
    status: 'ISSUED'
  },
  include: {
    type: true,
    transactions: {
      where: { returnedAt: null },
      orderBy: { issuedAt: 'desc' },
      take: 1
    }
  }
});
```

### Verfügbare Poolkleidung
```typescript
const availablePool = await prisma.clothingItem.findMany({
  where: {
    category: 'POOL',
    status: 'AVAILABLE',
    condition: { in: ['NEW', 'GOOD'] }
  },
  include: { type: true }
});
```

### Historie eines Kleidungsstücks
```typescript
const history = await prisma.transaction.findMany({
  where: { clothingItemId },
  include: {
    employee: true,
    issuedBy: true,
    returnedBy: true
  },
  orderBy: { issuedAt: 'desc' }
});
```

### Offene Rückgaben
```typescript
const pendingReturns = await prisma.transaction.findMany({
  where: {
    returnedAt: null,
    issuedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // > 90 Tage
  },
  include: {
    employee: true,
    clothingItem: { include: { type: true } }
  }
});
```

## Backup-Strategie

### Automatisches Backup
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
sqlite3 /app/data/bekleidung.db ".backup /app/backups/bekleidung_$DATE.db"
sqlite3 /app/backups/bekleidung_$DATE.db "VACUUM;"

# Alte Backups löschen (älter als 30 Tage)
find /app/backups -name "bekleidung_*.db" -mtime +30 -delete
```

### Restore
```bash
#!/bin/bash
# restore.sh
cp /app/backups/bekleidung_20251216_120000.db /app/data/bekleidung.db
```
