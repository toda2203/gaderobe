-- CreateTable
CREATE TABLE "confirmations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "transactionId" TEXT,
    "protocolId" TEXT,
    "employeeId" TEXT NOT NULL,
    "protocolType" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" DATETIME,
    "confirmedBy" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" DATETIME,
    "emailError" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "confirmations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "confirmations_token_key" ON "confirmations"("token");

-- CreateIndex
CREATE INDEX "confirmations_token_idx" ON "confirmations"("token");

-- CreateIndex
CREATE INDEX "confirmations_employeeId_idx" ON "confirmations"("employeeId");

-- CreateIndex
CREATE INDEX "confirmations_confirmed_idx" ON "confirmations"("confirmed");

-- CreateIndex
CREATE INDEX "confirmations_expiresAt_idx" ON "confirmations"("expiresAt");
