-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entraId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "role" TEXT NOT NULL DEFAULT 'READ_ONLY',
    "lastSyncAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "clothing_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "availableSizes" TEXT NOT NULL,
    "expectedLifespanMonths" INTEGER,
    "requiresDepartment" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "clothing_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "internalId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'POOL',
    "condition" TEXT NOT NULL DEFAULT 'NEW',
    "imageUrl" TEXT,
    "qrCode" TEXT NOT NULL,
    "isPersonalized" BOOLEAN NOT NULL DEFAULT false,
    "personalizedForId" TEXT,
    "currentEmployeeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "purchaseDate" DATETIME,
    "purchasePrice" REAL,
    "retirementDate" DATETIME,
    "retirementReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "clothing_items_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "clothing_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "clothing_items_personalizedForId_fkey" FOREIGN KEY ("personalizedForId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "clothing_items_currentEmployeeId_fkey" FOREIGN KEY ("currentEmployeeId") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "clothingItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT NOT NULL,
    "conditionOnIssue" TEXT NOT NULL,
    "returnedAt" DATETIME,
    "returnedById" TEXT,
    "conditionOnReturn" TEXT,
    "signatureUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "transactions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_clothingItemId_fkey" FOREIGN KEY ("clothingItemId") REFERENCES "clothing_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "changes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "department_allocations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "department" TEXT NOT NULL,
    "clothingTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "renewalIntervalMonths" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "department_allocations_clothingTypeId_fkey" FOREIGN KEY ("clothingTypeId") REFERENCES "clothing_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_entraId_key" ON "employees"("entraId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_entraId_idx" ON "employees"("entraId");

-- CreateIndex
CREATE INDEX "employees_email_idx" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_department_idx" ON "employees"("department");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "clothing_types_name_key" ON "clothing_types"("name");

-- CreateIndex
CREATE INDEX "clothing_types_name_idx" ON "clothing_types"("name");

-- CreateIndex
CREATE INDEX "clothing_types_isActive_idx" ON "clothing_types"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "clothing_items_internalId_key" ON "clothing_items"("internalId");

-- CreateIndex
CREATE UNIQUE INDEX "clothing_items_qrCode_key" ON "clothing_items"("qrCode");

-- CreateIndex
CREATE INDEX "clothing_items_internalId_idx" ON "clothing_items"("internalId");

-- CreateIndex
CREATE INDEX "clothing_items_qrCode_idx" ON "clothing_items"("qrCode");

-- CreateIndex
CREATE INDEX "clothing_items_typeId_idx" ON "clothing_items"("typeId");

-- CreateIndex
CREATE INDEX "clothing_items_category_idx" ON "clothing_items"("category");

-- CreateIndex
CREATE INDEX "clothing_items_status_idx" ON "clothing_items"("status");

-- CreateIndex
CREATE INDEX "clothing_items_currentEmployeeId_idx" ON "clothing_items"("currentEmployeeId");

-- CreateIndex
CREATE INDEX "transactions_employeeId_idx" ON "transactions"("employeeId");

-- CreateIndex
CREATE INDEX "transactions_clothingItemId_idx" ON "transactions"("clothingItemId");

-- CreateIndex
CREATE INDEX "transactions_issuedAt_idx" ON "transactions"("issuedAt");

-- CreateIndex
CREATE INDEX "transactions_returnedAt_idx" ON "transactions"("returnedAt");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_performedById_idx" ON "audit_logs"("performedById");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "department_allocations_department_idx" ON "department_allocations"("department");

-- CreateIndex
CREATE UNIQUE INDEX "department_allocations_department_clothingTypeId_key" ON "department_allocations"("department", "clothingTypeId");
