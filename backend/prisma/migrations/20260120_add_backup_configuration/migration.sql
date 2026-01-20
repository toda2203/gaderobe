-- CreateTable
CREATE TABLE "backup_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "schedule" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL DEFAULT 0,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "includeImages" BOOLEAN NOT NULL DEFAULT true,
    "includeProtocols" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnSuccess" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnError" BOOLEAN NOT NULL DEFAULT true,
    "notificationEmail" TEXT,
    "lastRunAt" DATETIME,
    "lastRunSuccess" BOOLEAN,
    "lastRunError" TEXT,
    "nextRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
