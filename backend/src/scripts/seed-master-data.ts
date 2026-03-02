import prisma from '../utils/database';

const sizes = [
  // Buchstaben-Größen mit Label
  'Herren - XS',
  'Herren - S',
  'Herren - M',
  'Herren - L',
  'Herren - XL',
  'Herren - XXL',
  'Damen - XS',
  'Damen - S',
  'Damen - M',
  'Damen - L',
  'Damen - XL',
  'Damen - XXL',
  'Unisex - XS',
  'Unisex - S',
  'Unisex - M',
  'Unisex - L',
  'Unisex - XL',
  'Unisex - XXL',
  // Konfektionsgrößen (gerade)
  '32',
  '34',
  '36',
  '38',
  '40',
  '42',
  '44',
  '46',
  '48',
  '50',
  '52',
  '54',
  '56',
  // Schuhgrößen (35-50)
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '49',
  '50',
];

const categories = ['Herren', 'Damen', 'Unisex'];
const departments = [
  'Vertrieb',
  'Service',
  'Werkstatt',
  'Lager',
  'IT',
  'HR',
  'Buchhaltung',
  'Allgemein',
];

async function seedList(type: 'SIZE' | 'CATEGORY' | 'DEPARTMENT', values: string[]) {
  try {
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      await prisma.masterDataItem.upsert({
        where: { type_value: { type, value } },
        update: { order: i },
        create: { type, value, order: i },
      });
    }

    // Delete any extras not in list
    await prisma.masterDataItem.deleteMany({
      where: {
        type,
        value: { notIn: values },
      },
    });

    console.log(`✓ Seeded ${type}: ${values.length} items`);
  } catch (error) {
    console.error(`✗ Failed to seed ${type}:`, error);
    throw error;
  }
}

async function main() {
  await seedList('SIZE', sizes);
  await seedList('CATEGORY', categories);
  await seedList('DEPARTMENT', departments);
    // Hilfsfunktion: Alle Mitarbeiter außer Admin löschen
    async function clearEmployeesExceptAdmin() {
      await prisma.employee.deleteMany({
        where: {
          NOT: {
            role: 'ADMIN',
          },
        },
      });
      // Optional: Admin-Passwort zurücksetzen
    }

    // Am Anfang des Seeds ausführen
    await clearEmployeesExceptAdmin();

    // Initialen Admin-Benutzer anlegen (falls nicht vorhanden)
    const adminEmail = 'admin@gaderobe.local';
    const adminPassword = 'admin123';
    let admin = await prisma.employee.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      admin = await prisma.employee.create({
        data: {
          email: adminEmail,
          passwordHash: passwordHash,
          firstName: 'Admin',
          lastName: 'User',
          department: 'IT',
          status: 'ACTIVE',
          role: 'ADMIN',
          isHidden: false,
        } as any, // Explizit als any casten, damit UncheckedCreateInput genutzt wird
      });
      console.log(`Initialer Admin-Benutzer erstellt: ${adminEmail} / ${adminPassword}`);
    } else {
      console.log('Admin-Benutzer existiert bereits.');
    }
  console.log('Seeded master data: sizes, categories, departments');
}

main()
  .catch((e) => {
    console.error('Failed to seed master data', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
