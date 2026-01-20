import { prisma } from '../src/utils/database';

async function getAllEmployees() {
  try {
    await prisma.$connect();
    
    const employees = await prisma.employee.findMany({
      include: {
        transactions: true,
        auditLogs: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n=== MITARBEITER IN DATABASE ===\n');
    console.log(`Gesamt: ${employees.length} Mitarbeiter\n`);
    
    employees.forEach((emp, index) => {
      console.log(`${index + 1}. ${emp.firstName} ${emp.lastName}`);
      console.log(`   Email: ${emp.email}`);
      console.log(`   Mitarbeiternummer: ${emp.employeeNumber}`);
      console.log(`   Department: ${emp.department}`);
      console.log(`   Rolle: ${emp.role}`);
      console.log(`   Status: ${emp.status}`);
      console.log(`   Erstellt: ${new Date(emp.createdAt).toLocaleString('de-DE')}`);
      console.log('');
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Fehler:', error);
    process.exit(1);
  }
}

getAllEmployees();
