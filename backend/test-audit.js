// Test script to manually create an audit log entry
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAuditLog() {
    try {
        console.log('Testing audit log creation...');

        // Check if audit_logs table exists
        const result = await prisma.$queryRaw `SHOW TABLES LIKE 'audit_logs'`;
        console.log('Audit logs table exists:', result.length > 0);

        if (result.length === 0) {
            console.log('Creating audit_logs table...');
            await prisma.$executeRaw `
        CREATE TABLE audit_logs (
          id VARCHAR(191) NOT NULL PRIMARY KEY,
          entityType VARCHAR(191) NOT NULL,
          entityId VARCHAR(191) NOT NULL,
          action VARCHAR(191) NOT NULL,
          performedById VARCHAR(191) NOT NULL,
          changes TEXT,
          ipAddress VARCHAR(191),
          userAgent VARCHAR(191),
          timestamp DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        )
      `;

            // Add indexes
            await prisma.$executeRaw `CREATE INDEX idx_audit_logs_entity ON audit_logs(entityType, entityId)`;
            await prisma.$executeRaw `CREATE INDEX idx_audit_logs_performer ON audit_logs(performedById)`;
            await prisma.$executeRaw `CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp)`;

            console.log('Audit logs table created successfully');
        }

        // Test creating an audit log entry
        const testEntry = await prisma.auditLog.create({
            data: {
                id: 'test-' + Date.now(),
                entityType: 'ClothingItem',
                entityId: 'test-item',
                action: 'TEST',
                performedById: 'system',
                changes: JSON.stringify({ test: { old: 'old_value', new: 'new_value' } }),
                ipAddress: '127.0.0.1',
                userAgent: 'test-script',
            }
        });

        console.log('Test audit log entry created:', testEntry.id);

        // Clean up test entry
        await prisma.auditLog.delete({ where: { id: testEntry.id } });
        console.log('Test entry cleaned up');

    } catch (error) {
        console.error('Error testing audit log:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testAuditLog();