-- Add audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    entityType VARCHAR(191) NOT NULL,
    entityId VARCHAR(191) NOT NULL,
    action VARCHAR(191) NOT NULL,
    performedById VARCHAR(191) NOT NULL,
    changes TEXT,
    ipAddress VARCHAR(191),
    userAgent VARCHAR(191),
    timestamp DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (performedById) REFERENCES employees(id) ON DELETE RESTRICT
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performer ON audit_logs(performedById);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);