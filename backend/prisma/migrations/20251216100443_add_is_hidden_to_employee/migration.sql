-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entraId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "role" TEXT NOT NULL DEFAULT 'READ_ONLY',
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_employees" ("createdAt", "department", "email", "entraId", "firstName", "id", "lastName", "lastSyncAt", "role", "status", "updatedAt") SELECT "createdAt", "department", "email", "entraId", "firstName", "id", "lastName", "lastSyncAt", "role", "status", "updatedAt" FROM "employees";
DROP TABLE "employees";
ALTER TABLE "new_employees" RENAME TO "employees";
CREATE UNIQUE INDEX "employees_entraId_key" ON "employees"("entraId");
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");
CREATE INDEX "employees_entraId_idx" ON "employees"("entraId");
CREATE INDEX "employees_email_idx" ON "employees"("email");
CREATE INDEX "employees_department_idx" ON "employees"("department");
CREATE INDEX "employees_status_idx" ON "employees"("status");
CREATE INDEX "employees_isHidden_idx" ON "employees"("isHidden");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
