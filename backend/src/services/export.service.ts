import prisma from '../utils/database';
import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';

export class ExportService {
  /**
   * Export all data to ZIP file with CSV files and uploads (images, logos, protocols)
   */
  async exportToCSVZip(): Promise<Buffer> {
    // Fetch all data
    const [
      employees,
      clothingTypes,
      clothingItems,
      transactions,
      auditLogs,
    ] = await Promise.all([
      prisma.employee.findMany(),
      prisma.clothingType.findMany(),
      prisma.clothingItem.findMany({
        include: {
          type: true,
          personalizedFor: true,
          currentEmployee: true,
        },
      }),
      prisma.transaction.findMany({
        include: {
          employee: true,
          clothingItem: {
            include: {
              type: true,
            },
          },
          issuedBy: true,
          returnedBy: true,
        },
      }),
      prisma.auditLog.findMany({
        include: {
          performedBy: true,
        },
      }),
    ]);

    // Create CSV contents
    const csvFiles: { [key: string]: string } = {};

    // Employees CSV
    const employeesData = employees.map((emp) => ({
      ID: emp.id,
      'Entra-ID': emp.entraId,
      Email: emp.email,
      Vorname: emp.firstName,
      Nachname: emp.lastName,
      Abteilung: emp.department || '',
      Status: emp.status,
      Rolle: emp.role,
      Versteckt: emp.isHidden ? 'Ja' : 'Nein',
      'Zuletzt synchronisiert': emp.lastSyncAt?.toISOString() || '',
      Erstellt: emp.createdAt.toISOString(),
      Aktualisiert: emp.updatedAt.toISOString(),
    }));
    csvFiles['mitarbeiter.csv'] = this.jsonToCSV(employeesData);

    // Clothing Types CSV
    const typesData = clothingTypes.map((type) => ({
      ID: type.id,
      Name: type.name,
      Kategorie: type.category,
      Beschreibung: type.description || '',
      'Verfügbare Größen': type.availableSizes || '',
      'Lebenserwartung (Monate)': type.expectedLifespanMonths || '',
      'Erforderliche Abteilungen': type.requiresDepartment || '',
      'Bild-URL': type.imageUrl || '',
      Aktiv: type.isActive ? 'Ja' : 'Nein',
      Erstellt: type.createdAt.toISOString(),
      Aktualisiert: type.updatedAt.toISOString(),
    }));
    csvFiles['kleidungstypen.csv'] = this.jsonToCSV(typesData);

    // Clothing Items CSV
    const itemsData = clothingItems.map((item) => ({
      ID: item.id,
      'Interne-ID': item.internalId,
      'Typ-ID': item.typeId,
      'Typ-Name': item.type.name,
      Größe: item.size,
      Kategorie: item.category,
      Status: item.status,
      Zustand: item.condition,
      'Personalisiert-für-ID': item.personalizedForId || '',
      'Personalisiert-für':
        item.personalizedFor &&
        `${item.personalizedFor.firstName} ${item.personalizedFor.lastName}`,
      'Aktueller Mitarbeiter-ID': item.currentEmployeeId || '',
      'Aktueller Mitarbeiter':
        item.currentEmployee &&
        `${item.currentEmployee.firstName} ${item.currentEmployee.lastName}`,
      'QR-Code': item.qrCode || '',
      'Bild-URL': item.imageUrl || '',
      Kaufdatum: item.purchaseDate?.toISOString() || '',
      Kaufpreis: item.purchasePrice || '',
      Ruhestandsdatum: item.retirementDate?.toISOString() || '',
      'Grund für Ruhestand': item.retirementReason || '',
      Erstellt: item.createdAt.toISOString(),
      Aktualisiert: item.updatedAt.toISOString(),
    }));
    csvFiles['kleidungsstuecke.csv'] = this.jsonToCSV(itemsData);

    // Transactions CSV
    const transactionsData = transactions.map((trans) => ({
      ID: trans.id,
      'Mitarbeiter-ID': trans.employeeId,
      Mitarbeiter: `${trans.employee.firstName} ${trans.employee.lastName}`,
      'Kleidungsstück-ID': trans.clothingItemId,
      'Kleidungsstück': trans.clothingItem.internalId,
      Typ: trans.type,
      'Ausgestellt am': trans.issuedAt.toISOString(),
      'Ausgestellt von-ID': trans.issuedById,
      'Ausgestellt von': `${trans.issuedBy.firstName} ${trans.issuedBy.lastName}`,
      'Zustand beim Ausstellen': trans.conditionOnIssue,
      'Zurückgegeben am': trans.returnedAt?.toISOString() || '',
      'Zurückgegeben von-ID': trans.returnedById || '',
      'Zurückgegeben von':
        trans.returnedBy &&
        `${trans.returnedBy.firstName} ${trans.returnedBy.lastName}`,
      'Zustand bei Rückgabe': trans.conditionOnReturn || '',
      'Unterschrift-URL': trans.signatureUrl || '',
      Notizen: trans.notes || '',
      Erstellt: trans.createdAt.toISOString(),
      Aktualisiert: trans.updatedAt.toISOString(),
    }));
    csvFiles['transaktionen.csv'] = this.jsonToCSV(transactionsData);

    // Audit Log CSV
    const auditData = auditLogs.map((log) => ({
      ID: log.id,
      'Entity Type': log.entityType,
      'Entity ID': log.entityId,
      Aktion: log.action,
      'Durchgeführt von-ID': log.performedById,
      'Durchgeführt von': `${log.performedBy.firstName} ${log.performedBy.lastName}`,
      Änderungen: log.changes || '',
      'IP-Adresse': log.ipAddress || '',
      'User Agent': log.userAgent || '',
      Zeitstempel: log.timestamp.toISOString(),
    }));
    csvFiles['audit-log.csv'] = this.jsonToCSV(auditData);

    // Create ZIP archive with JSZip
    const zip = new JSZip();
    for (const [filename, content] of Object.entries(csvFiles)) {
      // Add UTF-8 BOM for Excel compatibility
      const contentWithBOM = '\uFEFF' + content;
      zip.file(filename, contentWithBOM);
    }

    // Add uploads directory (images, logos, protocols)
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const uploadFolder = zip.folder('uploads');
      if (uploadFolder) {
        this.addFilesRecursively(uploadsDir, uploadFolder, '');
      }
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });
    return zipBuffer;
  }

  /**
   * Recursively add files to ZIP
   */
  private addFilesRecursively(dir: string, zipFolder: JSZip, relativePath: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const zipPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subFolder = zipFolder.folder(entry.name);
        if (subFolder) {
          this.addFilesRecursively(fullPath, subFolder, zipPath);
        }
      } else if (entry.isFile()) {
        const fileBuffer = fs.readFileSync(fullPath);
        zipFolder.file(entry.name, fileBuffer);
      }
    }
  }

  /**
   * Recursively extract files from ZIP to directory
   */
  private async extractFilesRecursively(zipFolder: JSZip, targetDir: string): Promise<void> {
    for (const [filename, file] of Object.entries(zipFolder.files)) {
      if (file.dir) {
        // Create subdirectory
        const subDir = path.join(targetDir, filename.replace(/\/$/, ''));
        if (!fs.existsSync(subDir)) {
          fs.mkdirSync(subDir, { recursive: true });
        }
      } else {
        // Extract file
        const targetPath = path.join(targetDir, filename);
        const targetSubDir = path.dirname(targetPath);
        if (!fs.existsSync(targetSubDir)) {
          fs.mkdirSync(targetSubDir, { recursive: true });
        }
        const content = await file.async('nodebuffer');
        fs.writeFileSync(targetPath, content);
      }
    }
  }

  /**
   * Import data from ZIP file with CSV files and uploads
   */
  async importFromCSVZip(buffer: Buffer): Promise<{
    success: boolean;
    imported: {
      employees: number;
      clothingTypes: number;
      clothingItems: number;
      transactions: number;
      auditLogs: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    const imported = {
      employees: 0,
      clothingTypes: 0,
      clothingItems: 0,
      transactions: 0,
      auditLogs: 0,
    };

    try {
      // Extract ZIP file
      const zip = new JSZip();
      await zip.loadAsync(buffer);

      // Restore uploads directory first
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Extract all files from uploads folder
      if (zip.folder('uploads')) {
        await this.extractFilesRecursively(zip.folder('uploads')!, uploadsDir);
      }

      // Helper function to parse CSV content
      const parseCSV = (content: string): Record<string, any>[] => {
        const lines = content.split('\n').filter((line) => line.trim());
        if (lines.length === 0) return [];

        // Remove BOM if present
        const firstLine = lines[0].replace(/^\uFEFF/, '');
        const headers = this.parseCSVLine(firstLine);
        const rows: Record<string, any>[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = this.parseCSVLine(lines[i]);
          const row: Record<string, any> = {};

          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });

          rows.push(row);
        }

        return rows;
      };

      // Read all CSVs first
      const employeesCsv = zip.files['mitarbeiter.csv']
        ? parseCSV(await zip.files['mitarbeiter.csv'].async('text'))
        : [];
      const typesCsv = zip.files['kleidungstypen.csv']
        ? parseCSV(await zip.files['kleidungstypen.csv'].async('text'))
        : [];
      const itemsCsv = zip.files['kleidungsstuecke.csv']
        ? parseCSV(await zip.files['kleidungsstuecke.csv'].async('text'))
        : [];
      const transactionsCsv = zip.files['transaktionen.csv']
        ? parseCSV(await zip.files['transaktionen.csv'].async('text'))
        : [];
      const auditsCsv = zip.files['audit-log.csv']
        ? parseCSV(await zip.files['audit-log.csv'].async('text'))
        : [];

      // Replace mode: wipe tables and re-insert in dependency-safe order
      // Use transaction with isolation to ensure atomicity
      await prisma.$transaction(
        async (tx) => {
          // Step 1: Delete in order (reverse of FK dependencies)
          // transactions -> auditLog -> clothingItem -> clothingType -> employee
          await tx.transaction.deleteMany({});
          await tx.auditLog.deleteMany({});
          await tx.clothingItem.deleteMany({});
          await tx.clothingType.deleteMany({});
          await tx.employee.deleteMany({});

          // Step 2: Insert in correct order (employees first, so they exist for FK)
          for (const row of employeesCsv) {
            await tx.employee.create({
              data: {
                id: row['ID'],
                entraId: row['Entra-ID'] || `entra-${Date.now()}`,
                email: row['Email'],
                firstName: row['Vorname'],
                lastName: row['Nachname'],
                department: row['Abteilung'] || '',
                status: row['Status'] || 'ACTIVE',
                role: row['Rolle'] || 'READ_ONLY',
                isHidden: row['Versteckt'] === 'Ja',
              },
            });
            imported.employees++;
          }

          // Insert Clothing Types
          for (const row of typesCsv) {
            await tx.clothingType.create({
              data: {
                id: row['ID'],
                name: row['Name'],
                category: row['Kategorie'],
                description: row['Beschreibung'] || '',
                availableSizes: row['Verfügbare Größen'] || '',
                imageUrl: row['Bild-URL'] || undefined,
                isActive: row['Aktiv'] === 'Ja',
              },
            });
            imported.clothingTypes++;
          }

          // Insert Clothing Items
          for (const row of itemsCsv) {
            await tx.clothingItem.create({
              data: {
                id: row['ID'],
                internalId: row['Interne-ID'],
                typeId: row['Typ-ID'],
                size: row['Größe'],
                category: row['Kategorie'],
                status: row['Status'] || 'AVAILABLE',
                condition: row['Zustand'] || 'GUT',
                qrCode: row['QR-Code'] || undefined,
                imageUrl: row['Bild-URL'] || undefined,
                personalizedForId: row['Personalisiert-für-ID'] || undefined,
                currentEmployeeId: row['Aktueller Mitarbeiter-ID'] || undefined,
              },
            });
            imported.clothingItems++;
          }

          // Insert Transactions
          for (const row of transactionsCsv) {
            await tx.transaction.create({
              data: {
                id: row['ID'],
                employeeId: row['Mitarbeiter-ID'],
                clothingItemId: row['Kleidungsstück-ID'],
                type: row['Typ'] || 'ISSUE',
                issuedAt: row['Ausgestellt am'] ? new Date(row['Ausgestellt am']) : new Date(),
                issuedById: row['Ausgestellt von-ID'],
                conditionOnIssue: row['Zustand beim Ausstellen'] || 'GUT',
                returnedAt: row['Zurückgegeben am'] ? new Date(row['Zurückgegeben am']) : undefined,
                returnedById: row['Zurückgegeben von-ID'] || undefined,
                conditionOnReturn: row['Zustand bei Rückgabe'] || undefined,
                signatureUrl: row['Unterschrift-URL'] || undefined,
                notes: row['Notizen'] || undefined,
              },
            });
            imported.transactions++;
          }

          // Insert Audit Logs (no explicit ID, auto-generated)
          for (const row of auditsCsv) {
            await tx.auditLog.create({
              data: {
                entityType: row['Entity Type'],
                entityId: row['Entity ID'],
                action: row['Aktion'],
                performedById: row['Durchgeführt von-ID'],
                changes: row['Änderungen'] || undefined,
                ipAddress: row['IP-Adresse'] || undefined,
                userAgent: row['User Agent'] || undefined,
                timestamp: row['Zeitstempel'] ? new Date(row['Zeitstempel']) : new Date(),
              },
            });
            imported.auditLogs++;
          }
        },
        {
          // Ensure transaction isolation for consistency
          isolationLevel: 'Serializable',
          maxWait: 10000,
          timeout: 30000,
        }
      );

      return {
        success: true,
        imported,
        errors: [],
      };
    } catch (error: any) {
      console.error('[Import Error]', error);
      return {
        success: false,
        imported,
        errors: [
          `Fehler beim Import der ZIP-Datei: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        ],
      };
    }
  }

  /**
   * Helper: Convert JSON to CSV string with UTF-8 BOM
   */
  private jsonToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Add header row
    csvRows.push(headers.map((h) => this.escapeCsvValue(h)).join(','));

    // Add data rows
    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        return this.escapeCsvValue(value);
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Escape CSV values properly
   */
  private escapeCsvValue(value: any): string {
    const stringValue = value === null || value === undefined ? '' : String(value);
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return `"${stringValue}"`;
  }

  /**
   * Recursively extract files from ZIP to directory
   */
  private async extractFilesRecursively(zipFolder: JSZip, targetDir: string): Promise<void> {
    for (const [filename, file] of Object.entries(zipFolder.files)) {
      if (file.dir) {
        // Create subdirectory
        const subDir = path.join(targetDir, filename.replace(/\/$/, ''));
        if (!fs.existsSync(subDir)) {
          fs.mkdirSync(subDir, { recursive: true });
        }
      } else {
        // Extract file
        const targetPath = path.join(targetDir, filename);
        const targetSubDir = path.dirname(targetPath);
        if (!fs.existsSync(targetSubDir)) {
          fs.mkdirSync(targetSubDir, { recursive: true });
        }
        const content = await file.async('nodebuffer');
        fs.writeFileSync(targetPath, content);
      }
    }
  }
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of value
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    // Add last value
    values.push(current);

    return values;
  }
}

export const exportService = new ExportService();
