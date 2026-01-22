import PDFDocument from 'pdfkit';
import prisma from '../utils/database';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import path from 'path';
import fs from 'fs';

dayjs.locale('de');

interface TransactionProtocolData {
  transactionId: string;
  type: 'issue' | 'return';
}

interface BulkProtocolData {
  transactionIds: string[];
}

class PDFService {
  /**
   * Add company logo to PDF if available
   */
  private addLogoToPDF(doc: any, x: number, y: number, maxWidth: number = 120, maxHeight: number = 60) {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const clothingImagesDir = path.join(uploadsDir, 'clothing-images');
      
      // First priority: Look for specifically uploaded company logo
      if (fs.existsSync(clothingImagesDir)) {
        const files = fs.readdirSync(clothingImagesDir);
        
        // Look specifically for company-logo files
        const companyLogoFile = files.find(file => 
          file.startsWith('company-logo.') && this.isImageFile(path.join(clothingImagesDir, file))
        );
        
        if (companyLogoFile) {
          const logoPath = path.join(clothingImagesDir, companyLogoFile);
          console.log('Found company logo:', companyLogoFile);
          try {
            const imageOptions: any = {
              fit: [maxWidth, maxHeight],
              align: 'left',
              valign: 'top'
            };
            doc.image(logoPath, x, y, imageOptions);
            return maxHeight + 10;
          } catch (imageError) {
            console.error('Error loading company logo:', imageError);
          }
        }
        
        // Fallback: Look for files with logo keywords
        const logoFiles = files.filter(file => {
          const fileLower = file.toLowerCase();
          return (fileLower.includes('logo') || fileLower.includes('company') || fileLower.includes('firma')) 
                 && this.isImageFile(path.join(clothingImagesDir, file));
        });
        
        if (logoFiles.length > 0) {
          // Sort by modification time (newest first)
          const sortedLogoFiles = logoFiles
            .map(file => ({
              name: file,
              path: path.join(clothingImagesDir, file),
              mtime: fs.statSync(path.join(clothingImagesDir, file)).mtime
            }))
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
          
          console.log('Found logo files:', sortedLogoFiles.map(f => f.name));
          
          for (const fileInfo of sortedLogoFiles) {
            try {
              const imageOptions: any = {
                fit: [maxWidth, maxHeight],
                align: 'left',
                valign: 'top'
              };
              doc.image(fileInfo.path, x, y, imageOptions);
              console.log('Successfully loaded logo:', fileInfo.name);
              return maxHeight + 10;
            } catch (imageError) {
              console.error('Error loading logo image:', imageError);
              continue;
            }
          }
        }
      }
      
      // Final fallback: check for standard logo files in uploads root
      const standardLogos = [
        'logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp',
        'company_logo.png', 'company_logo.jpg', 'company_logo.jpeg', 'company_logo.webp',
        'firmenlogo.png', 'firmenlogo.jpg', 'firmenlogo.jpeg', 'firmenlogo.webp'
      ];
      
      for (const logoFile of standardLogos) {
        const logoPath = path.join(uploadsDir, logoFile);
        if (fs.existsSync(logoPath)) {
          console.log('Found standard logo file:', logoFile);
          try {
            const imageOptions: any = {
              fit: [maxWidth, maxHeight],
              align: 'left',
              valign: 'top'
            };
            doc.image(logoPath, x, y, imageOptions);
            return maxHeight + 10;
          } catch (imageError) {
            console.error('Error loading standard logo:', imageError);
            continue;
          }
        }
      }
      
      console.log('No company logo found');
      return 0; // No logo found
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
      return 0;
    }
  }

  private isImageFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
  }
  /**
   * Generate issue/return protocol PDF
   */
  async generateTransactionProtocol(data: TransactionProtocolData): Promise<Buffer> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: data.transactionId },
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
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // For issue protocols, get confirmation data
    let confirmation = null;
    if (data.type === 'issue') {
      confirmation = await prisma.confirmation.findFirst({
        where: {
          employeeId: transaction.employeeId,
          confirmed: true,
          itemsJson: {
            contains: data.transactionId
          }
        }
      });
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add logo if available
      const logoHeight = this.addLogoToPDF(doc, 50, 50);
      if (logoHeight > 0) {
        doc.y = 50 + logoHeight;
      }

      // Header
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(
          data.type === 'issue' ? 'Ausgabeprotokoll' : 'Rücknahmeprotokoll',
          { align: 'center' }
        );

      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').text(`Protokoll-Nr.: ${transaction.id}`, { align: 'right' });
      doc.text(`Datum: ${dayjs().format('DD.MM.YYYY HH:mm')}`, { align: 'right' });

      doc.moveDown(1);

      // Compact info in two columns
      const leftColumn = 280;
      const rightColumn = 320;
      let currentY = doc.y;

      // Left column - Employee Info
      doc.fontSize(12).font('Helvetica-Bold').text('Mitarbeiter', 50, currentY);
      currentY += 15;
      doc.fontSize(9).font('Helvetica');
      doc.text(`${transaction.employee.firstName} ${transaction.employee.lastName}`, 50, currentY);
      currentY += 12;
      doc.text(`${transaction.employee.email}`, 50, currentY);
      currentY += 12;
      doc.text(`Abt.: ${transaction.employee.department}`, 50, currentY);

      // Reset for right column
      currentY = doc.y - 39; // Back to start of left column

      // Right column - Clothing Item Info
      doc.fontSize(12).font('Helvetica-Bold').text('Kleidungsstück', rightColumn, currentY);
      currentY += 15;
      doc.fontSize(9).font('Helvetica');
      doc.text(`${transaction.clothingItem.type.name}`, rightColumn, currentY);
      currentY += 12;
      doc.text(`ID: ${transaction.clothingItem.internalId}`, rightColumn, currentY);
      currentY += 12;
      doc.text(`Größe: ${transaction.clothingItem.size}`, rightColumn, currentY);

      // Move down past both columns
      doc.y = Math.max(doc.y, currentY + 20);

      // Transaction Details - compact
      doc.fontSize(12).font('Helvetica-Bold').text('Details');
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica');

      if (data.type === 'issue') {
        doc.text(
          `Ausgabe: ${dayjs(transaction.issuedAt).format('DD.MM.YYYY HH:mm')} von ${transaction.issuedBy.firstName} ${transaction.issuedBy.lastName}`
        );
        doc.text(`Zustand: ${this.getConditionLabel(transaction.conditionOnIssue)}`);
        
        // Add confirmation details if available
        if (confirmation && confirmation.confirmedAt) {
          doc.moveDown(0.5);
          doc.fontSize(10).font('Helvetica-Bold').text('✓ DIGITAL BESTÄTIGT');
          doc.fontSize(9).font('Helvetica');
          doc.text(
            `Angenommen: ${dayjs(confirmation.confirmedAt).format('DD.MM.YYYY HH:mm')}`
          );
        }
      } else {
        doc.text(
          `Ausgabe: ${dayjs(transaction.issuedAt).format('DD.MM.YYYY HH:mm')} | Rückgabe: ${transaction.returnedAt ? dayjs(transaction.returnedAt).format('DD.MM.YYYY HH:mm') : 'N/A'}`
        );
        doc.text(
          `Rücknahme: ${transaction.returnedBy ? `${transaction.returnedBy.firstName} ${transaction.returnedBy.lastName}` : 'N/A'}`
        );
        doc.text(`Zustand: Ausgabe: ${this.getConditionLabel(transaction.conditionOnIssue)} | ${transaction.conditionOnReturn ? `Rückgabe: ${this.getConditionLabel(transaction.conditionOnReturn)}` : 'N/A'}`);
      }

      if (transaction.notes) {
        doc.moveDown(0.5);
        doc.text(`Notizen: ${transaction.notes}`);
      }

      // Compact footer
      doc.fontSize(8).font('Helvetica').text(
        'Digital erstellt - keine Unterschrift erforderlich',
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 }
      );

      doc.end();
    });
  }

  /**
   * Generate bulk issue protocol PDF (multiple items to one employee)
   */
  async generateBulkIssueProtocol(data: BulkProtocolData): Promise<Buffer> {
    const transactions = await prisma.transaction.findMany({
      where: { id: { in: data.transactionIds } },
      include: {
        employee: true,
        clothingItem: {
          include: {
            type: true,
          },
        },
        issuedBy: true,
      },
    });

    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions found');
    }

    // All transactions should be for the same employee
    const employee = transactions[0].employee;

    // Get confirmation data if available
    const confirmation = await prisma.confirmation.findFirst({
      where: {
        employeeId: employee.id,
        confirmed: true,
        itemsJson: {
          contains: data.transactionIds[0] // Check if any transaction ID is in the confirmation
        }
      }
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add logo if available
      const logoHeight = this.addLogoToPDF(doc, 50, 50);
      if (logoHeight > 0) {
        doc.y = 50 + logoHeight;
      }

      // Header
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('Ausgabeprotokoll', { align: 'center' });

      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').text(`Protokoll-Datum: ${dayjs().format('DD.MM.YYYY HH:mm')}`, { align: 'right' });

      doc.moveDown(1);

      // Employee Info
      doc.fontSize(14).font('Helvetica-Bold').text('Mitarbeiter');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Name: ${employee.firstName} ${employee.lastName}`);
      doc.text(`E-Mail: ${employee.email}`);
      doc.text(`Abteilung: ${employee.department}`);

      // Add confirmation details if available
      if (confirmation && confirmation.confirmedAt) {
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('Bestätigung des Erhalts');
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica');
        doc.text(
          `Angenommen am: ${dayjs(confirmation.confirmedAt).format('DD.MM.YYYY HH:mm')}`
        );
        doc.text(
          `Bestätigt durch: ${employee.firstName} ${employee.lastName}`
        );
      }

      doc.moveDown(2);

      // Items Header
      doc.fontSize(14).font('Helvetica-Bold').text(`Ausgegebene Artikel (${transactions.length})`);
      doc.moveDown(1);

      // Table Header
      doc.fontSize(10).font('Helvetica-Bold');
      const startY = doc.y;
      const colX = {
        nr: 50,
        type: 80,
        id: 220,
        size: 320,
        condition: 380,
        date: 460,
      };

      doc.text('Nr.', colX.nr, startY);
      doc.text('Typ', colX.type, startY);
      doc.text('Interne ID', colX.id, startY);
      doc.text('Größe', colX.size, startY);
      doc.text('Zustand', colX.condition, startY);
      doc.text('Datum', colX.date, startY);

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Table Rows
      doc.fontSize(9).font('Helvetica');
      transactions.forEach((transaction, index) => {
        const rowY = doc.y;
        
        if (rowY > 700) {
          doc.addPage();
          doc.fontSize(9).font('Helvetica');
        }

        doc.text(`${index + 1}`, colX.nr, doc.y);
        doc.text(transaction.clothingItem.type.name, colX.type, rowY, { width: 130, ellipsis: true });
        doc.text(transaction.clothingItem.internalId, colX.id, rowY, { width: 90 });
        doc.text(transaction.clothingItem.size, colX.size, rowY);
        doc.text(this.getConditionLabel(transaction.conditionOnIssue), colX.condition, rowY, { width: 70 });
        doc.text(dayjs(transaction.issuedAt).format('DD.MM.YYYY'), colX.date, rowY);

        doc.moveDown();
      });

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

      // Digital Confirmation Section
      doc.moveDown(3);
      doc.fontSize(12).font('Helvetica-Bold').text('Digitale Bestätigung');
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica');
      
      if (confirmation && confirmation.confirmedAt) {
        doc.fillColor('#059669'); // Green color
        doc.text('✓ BESTÄTIGT', { continued: true });
        doc.fillColor('black');
        doc.text(` - ${dayjs(confirmation.confirmedAt).format('DD.MM.YYYY HH:mm')}`);
        doc.text(`Digitale Annahme durch: ${employee.firstName} ${employee.lastName}`);
        doc.text('Der Mitarbeiter hat den Erhalt aller Kleidungsstücke digital bestätigt.');
      } else {
        doc.fillColor('#dc2626'); // Red color
        doc.text('⚠ AUSSTEHEND');
        doc.fillColor('black');
        doc.text('Die digitale Bestätigung des Erhalts steht noch aus.');
      }

      doc.moveDown(2);
      
      // Processing Information
      doc.fontSize(10).font('Helvetica');
      doc.text('Verarbeitung:', 50, doc.y);
      doc.text(
        transactions[0].issuedBy
          ? `Ausgegeben durch: ${transactions[0].issuedBy.firstName} ${transactions[0].issuedBy.lastName}`
          : 'Ausgegeben durch: System',
        50,
        doc.y + 15
      );
      doc.text(`Ausgabedatum: ${dayjs(transactions[0].issuedAt).format('DD.MM.YYYY HH:mm')}`, 50, doc.y + 30);

      // Footer
      doc.fontSize(8).text(
        'Dieses Protokoll wurde digital erstellt und verarbeitet. Unterschriften sind nicht erforderlich.',
        50,
        doc.page.height - 50,
        { align: 'center', width: doc.page.width - 100 }
      );

      doc.end();
    });
  }

  /**
   * Generate bulk return protocol PDF (multiple items returned by one employee)
   */
  async generateBulkReturnProtocol(data: BulkProtocolData): Promise<Buffer> {
    const transactions = await prisma.transaction.findMany({
      where: { id: { in: data.transactionIds } },
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
    });

    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions found');
    }

    // All transactions should be for the same employee
    const employee = transactions[0].employee;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add logo if available
      const logoHeight = this.addLogoToPDF(doc, 50, 50);
      if (logoHeight > 0) {
        doc.y = 50 + logoHeight;
      }

      // Header
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('Rücknahmeprotokoll', { align: 'center' });

      doc.moveDown();
      doc.fontSize(10).font('Helvetica').text(`Protokoll-Datum: ${dayjs().format('DD.MM.YYYY HH:mm')}`, { align: 'right' });

      doc.moveDown(2);

      // Employee Info
      doc.fontSize(14).font('Helvetica-Bold').text('Mitarbeiter');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Name: ${employee.firstName} ${employee.lastName}`);
      doc.text(`E-Mail: ${employee.email}`);
      doc.text(`Abteilung: ${employee.department}`);

      doc.moveDown(2);

      // Items Header
      doc.fontSize(14).font('Helvetica-Bold').text(`Zurückgenommene Artikel (${transactions.length})`);
      doc.moveDown(1);

      // Table Header
      doc.fontSize(10).font('Helvetica-Bold');
      const startY = doc.y;
      const colX = {
        nr: 50,
        type: 80,
        id: 220,
        size: 320,
        condition: 380,
        date: 460,
      };

      doc.text('Nr.', colX.nr, startY);
      doc.text('Typ', colX.type, startY);
      doc.text('Interne ID', colX.id, startY);
      doc.text('Größe', colX.size, startY);
      doc.text('Zustand', colX.condition, startY);
      doc.text('Datum', colX.date, startY);

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Table Rows
      doc.fontSize(9).font('Helvetica');
      transactions.forEach((transaction, index) => {
        const rowY = doc.y;
        
        if (rowY > 700) {
          doc.addPage();
          doc.fontSize(9).font('Helvetica');
        }

        doc.text(`${index + 1}`, colX.nr, doc.y);
        doc.text(transaction.clothingItem.type.name, colX.type, rowY, { width: 130, ellipsis: true });
        doc.text(transaction.clothingItem.internalId, colX.id, rowY, { width: 90 });
        doc.text(transaction.clothingItem.size, colX.size, rowY);
        doc.text(
          this.getConditionLabel(transaction.conditionOnReturn || transaction.conditionOnIssue),
          colX.condition,
          rowY,
          { width: 70 }
        );
        doc.text(dayjs(transaction.returnedAt || transaction.issuedAt).format('DD.MM.YYYY'), colX.date, rowY);

        doc.moveDown();
      });

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

      // Digital Documentation Section  
      doc.moveDown(3);
      doc.fontSize(12).font('Helvetica-Bold').text('Digitale Dokumentation');
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica');
      
      // Processing Information
      const returnedBy = transactions[0].returnedBy;
      if (returnedBy) {
        doc.text(`Rücknahme dokumentiert durch: ${returnedBy.firstName} ${returnedBy.lastName}`);
        doc.text(`Rücknahmedatum: ${transactions[0].returnedAt ? dayjs(transactions[0].returnedAt).format('DD.MM.YYYY HH:mm') : 'N/A'}`);
      } else {
        doc.text('Rücknahme automatisch dokumentiert');
      }
      
      doc.text('Die Rücknahme aller Kleidungsstücke wurde digital dokumentiert.');
      doc.text('Unterschriften sind nicht erforderlich.');

      // Footer
      doc.fontSize(8).text(
        'Dieses Protokoll wurde digital erstellt und verarbeitet. Unterschriften sind nicht erforderlich.',
        50,
        doc.page.height - 50,
        { align: 'center', width: doc.page.width - 100 }
      );

      doc.end();
    });
  }

  /**
   * Generate inventory report
   */
  async generateInventoryReport(filters?: {
    status?: string;
    category?: string;
  }): Promise<Buffer> {
    const items = await prisma.clothingItem.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.category && { category: filters.category }),
      },
      include: {
        type: true,
        personalizedFor: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50, layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('Inventarbericht', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).font('Helvetica').text(`Erstellt am: ${dayjs().format('DD.MM.YYYY HH:mm')}`, { align: 'right' });
      doc.text(`Gesamt: ${items.length} Artikel`, { align: 'right' });

      doc.moveDown(2);

      // Table Header
      const tableTop = doc.y;
      const colWidths = { id: 100, type: 120, size: 50, status: 80, condition: 80, person: 120 };
      let currentX = 50;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Interne ID', currentX, tableTop, { width: colWidths.id });
      currentX += colWidths.id;
      doc.text('Typ', currentX, tableTop, { width: colWidths.type });
      currentX += colWidths.type;
      doc.text('Größe', currentX, tableTop, { width: colWidths.size });
      currentX += colWidths.size;
      doc.text('Status', currentX, tableTop, { width: colWidths.status });
      currentX += colWidths.status;
      doc.text('Zustand', currentX, tableTop, { width: colWidths.condition });
      currentX += colWidths.condition;
      doc.text('Person', currentX, tableTop, { width: colWidths.person });

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
      doc.moveDown(0.5);

      // Table Rows
      doc.fontSize(9).font('Helvetica');
      items.forEach((item, index) => {
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
          doc.y = 50;
        }

        const rowY = doc.y;
        currentX = 50;

        doc.text(item.internalId, currentX, rowY, { width: colWidths.id, ellipsis: true });
        currentX += colWidths.id;
        doc.text(item.type.name, currentX, rowY, { width: colWidths.type, ellipsis: true });
        currentX += colWidths.type;
        doc.text(item.size, currentX, rowY, { width: colWidths.size });
        currentX += colWidths.size;
        doc.text(this.getStatusLabel(item.status), currentX, rowY, { width: colWidths.status });
        currentX += colWidths.status;
        doc.text(this.getConditionLabel(item.condition), currentX, rowY, { width: colWidths.condition });
        currentX += colWidths.condition;
        if (item.personalizedFor) {
          doc.text(
            `${item.personalizedFor.firstName} ${item.personalizedFor.lastName}`,
            currentX,
            rowY,
            { width: colWidths.person, ellipsis: true }
          );
        }

        doc.moveDown();
      });

      // Footer
      doc.fontSize(8).text(
        'Autohaus Graupner - Bekleidungsverwaltung',
        50,
        doc.page.height - 50,
        { align: 'center', width: doc.page.width - 100 }
      );

      doc.end();
    });
  }

  private getConditionLabel(condition: string): string {
    const labels: Record<string, string> = {
      NEW: 'Neu',
      GOOD: 'Gut',
      ACCEPTABLE: 'Akzeptabel',
      WORN: 'Abgenutzt',
      DAMAGED: 'Beschädigt',
    };
    return labels[condition] || condition;
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      AVAILABLE: 'Verfügbar',
      ISSUED: 'Ausgegeben',
      DAMAGED: 'Beschädigt',
      RETIRED: 'Ausgemustert',
    };
    return labels[status] || status;
  }
}

export const pdfService = new PDFService();
