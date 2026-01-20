const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setAdmin() {
    try {
        const updated = await prisma.employee.update({
            where: { email: 'd.troks@autohaus-graupner.de' },
            data: { role: 'ADMIN' }
        });

        console.log('✅ Daniel Troks ist jetzt ADMIN');
        console.log('Updated:', updated.email, '->', updated.role);
    } catch (error) {
        console.error('❌ Fehler:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

setAdmin();