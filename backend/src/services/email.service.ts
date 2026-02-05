import nodemailer from 'nodemailer';
import { config } from '../config';

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Email-Modus: Aus .env geladen (nicht änderbar zur Laufzeit)
const EMAIL_MODE = (process.env.EMAIL_MODE as 'production' | 'development') || 'development';
const TEST_EMAIL_ADDRESS = process.env.TEST_EMAIL_ADDRESS || '';

if (EMAIL_MODE === 'development' && !TEST_EMAIL_ADDRESS) {
  console.warn('[EMAIL SERVICE] WARNING: EMAIL_MODE is "development" but TEST_EMAIL_ADDRESS is not set in .env!');
}

console.log(`[EMAIL SERVICE] Initialized with mode: ${EMAIL_MODE}, test address: ${TEST_EMAIL_ADDRESS || 'not configured'}`);

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // For development/production - configure based on your email provider
    // This is a basic SMTP configuration - adjust based on your email service
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.office365.com', // Microsoft Exchange
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER, // Your email
        pass: process.env.SMTP_PASS, // Your password or app password
      },
      tls: {
        ciphers: 'SSLv3',
      },
    });
  }

  // Email-Modus abrufen (read-only)
  static getEmailMode() {
    return { 
      mode: EMAIL_MODE, 
      testAddress: TEST_EMAIL_ADDRESS,
      isConfigurable: false // Nicht zur Laufzeit änderbar
    };
  }

  // Instanzmethode zum Abrufen der Konfiguration
  getConfig() {
    return { 
      mode: EMAIL_MODE, 
      testAddress: TEST_EMAIL_ADDRESS,
      isConfigurable: false
    };
  }

  // Zieladresse bestimmen (basierend auf Modus aus .env)
  private getRecipientEmail(originalEmail: string): { to: string; originalEmail: string } {
    if (EMAIL_MODE === 'development') {
      return { to: TEST_EMAIL_ADDRESS, originalEmail };
    }
    return { to: originalEmail, originalEmail };
  }

  async sendConfirmationEmail(options: {
    employeeEmail: string;
    employeeName: string;
    confirmationUrl: string;
    protocolType: string;
    items: any[];
    expiresAt: Date;
  }): Promise<boolean> {
    try {
      const { employeeEmail, employeeName, confirmationUrl, protocolType, items, expiresAt } = options;

      // Debug: Log current email mode
      console.log(`[EMAIL SERVICE] Current mode: ${EMAIL_MODE}, Test address: ${TEST_EMAIL_ADDRESS}`);

      // Bestimme Zieladresse basierend auf Modus
      const { to: recipientEmail, originalEmail } = this.getRecipientEmail(employeeEmail);

      console.log(`[EMAIL SERVICE] Sending email to: ${recipientEmail}${EMAIL_MODE === 'development' ? ` (DEV MODE - Original: ${employeeEmail})` : ''}`);

      // Generate email content
      const template = this.generateConfirmationTemplate({
        employeeName,
        confirmationUrl,
        protocolType,
        items,
        expiresAt,
        isDevelopmentMode: EMAIL_MODE === 'development',
        originalEmail: EMAIL_MODE === 'development' ? employeeEmail : undefined,
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: recipientEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${recipientEmail}${EMAIL_MODE === 'development' ? ` (DEV MODE - Original: ${employeeEmail})` : ''}:`, result.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  private generateConfirmationTemplate(options: {
    employeeName: string;
    confirmationUrl: string;
    protocolType: string;
    items: any[];
    expiresAt: Date;
    isDevelopmentMode?: boolean;
    originalEmail?: string;
  }): EmailTemplate {
    const { employeeName, confirmationUrl, protocolType, items, expiresAt, isDevelopmentMode, originalEmail } = options;

    // Asset base for absolute URLs (images, logo)
    // Verwendet APP_HOST und FRONTEND_PORT aus .env (Fallback nur für Entwicklung)
    const assetBase = `https://${process.env.APP_HOST || 'localhost'}:${process.env.FRONTEND_PORT || '3078'}`;
    const companyLogoUrl = process.env.COMPANY_LOGO_URL ? `${assetBase}${process.env.COMPANY_LOGO_URL}` : '';

    // Determine protocol type in German
    const protocolTypeGerman = {
      SINGLE: 'Einzelausgabe',
      BULK_ISSUE: 'Sammelausgabe',
      BULK_RETURN: 'Sammelrückgabe',
    }[protocolType] || 'Protokoll';

    // Group items by name + size (and image) for a compact summary
    const groupedMap = new Map<string, { name: string; size: string; imageUrl?: string; quantity: number }>();
    (items || []).forEach((item: any) => {
      const name = (item?.name || 'Unbekannter Artikel').trim();
      const size = (item?.size || 'N/A').toString().trim();
      const imageUrl = item?.imageUrl || undefined;
      const key = `${name}|${size}|${imageUrl || ''}`;
      const qty = Number(item?.quantity) || 1;
      const existing = groupedMap.get(key);
      if (existing) {
        existing.quantity += qty;
      } else {
        groupedMap.set(key, { name, size, imageUrl, quantity: qty });
      }
    });
    const groupedItems = Array.from(groupedMap.values());

    // Plain-text summary
    const itemsText = groupedItems
      .map((g) => `• ${g.quantity}x ${g.name} (Größe: ${g.size})`)
      .join('\n');

    const subject = `Garderobe - Bitte bestätigen Sie den Erhalt (${protocolTypeGerman})`;

    const text = `
Hallo ${employeeName},

bitte bestätigen Sie den Erhalt der folgenden Kleidungsstücke:

Protokoll-Art: ${protocolTypeGerman}

Erhaltene Artikel:
${itemsText}

Um den Erhalt zu bestätigen, klicken Sie bitte auf den folgenden Link:
${confirmationUrl}

Dieser Link ist gültig bis: ${expiresAt.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}

Sie werden zur Bestätigung zu einem sicheren Microsoft-Login weitergeleitet.

Mit freundlichen Grüßen
Ihr Garderobe-Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: #1F2937; /* neutral-800 */
      margin: 0;
      padding: 0;
      background-color: #F5F7FA; /* neutral background */
    }
    .container {
      max-width: 640px;
      margin: 24px auto;
      background: #FFFFFF;
      border: 1px solid #E5E7EB; /* neutral-300 */
      border-radius: 8px;
    }
    .header {
      display: flex;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #E5E7EB;
      background: #FFFFFF;
    }
    .logo {
      height: 28px;
    }
    .brand {
      font-weight: 600;
      font-size: 16px;
      color: #0B5CFF;
      margin-left: 8px;
    }
    .content {
      padding: 24px 24px 8px 24px;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 12px 0;
      color: #111827;
    }
    .subtle {
      color: #4B5563;
      margin: 0 0 16px 0;
    }
    .info-box {
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      padding: 12px 14px;
      margin: 12px 0 20px 0;
      background: #FAFAFA;
    }
    .warning-box {
      border: 2px solid #FFA500;
      border-radius: 6px;
      padding: 12px 14px;
      margin: 12px 0 20px 0;
      background: #FFF8F0;
      color: #B8560D;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      overflow: hidden;
    }
    .items-table th {
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      color: #374151;
      background: #F9FAFB;
      padding: 10px 12px;
      border-bottom: 1px solid #E5E7EB;
    }
    .items-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #E5E7EB;
      vertical-align: middle;
    }
    .items-table tr:last-child td { border-bottom: none; }
    .thumb {
      width: 44px;
      height: 44px;
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      margin-right: 12px;
      object-fit: cover;
      background: #F3F4F6;
    }
    .thumb.placeholder { background: #F3F4F6; }
    .item-name { font-weight: 500; color: #111827; }
    .item-meta { font-size: 12px; color: #6B7280; }
    .cta {
      text-align: center;
      padding: 20px 24px 28px 24px;
    }
    .button {
      display: inline-block;
      background: #0B5CFF;
      color: #FFFFFF;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      border: 1px solid #0A53E6;
    }
    .meta {
      padding: 0 24px 24px 24px;
      font-size: 12px;
      color: #6B7280;
    }
    .footer {
      border-top: 1px solid #E5E7EB;
      padding: 16px 24px;
      font-size: 12px;
      color: #6B7280;
      background: #FAFAFA;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${companyLogoUrl ? `<img class="logo" src="${companyLogoUrl}" alt="Logo">` : ''}
      <div class="brand">Garderobe</div>
    </div>
    <div class="content">
      <h1 class="title">Bestätigung des Erhalts</h1>
      ${isDevelopmentMode ? `
      <div class="warning-box">
        <strong>⚠️ ENTWICKLUNG/TEST-MODUS</strong><br>
        Diese E-Mail wird im Test-Modus verschickt. Ursprüngliche Adresse: <strong>${originalEmail}</strong>
      </div>
      ` : ''}
      <p class="subtle">Hallo ${employeeName}, bitte bestätigen Sie den Erhalt der folgenden Kleidungsstücke.</p>
      <div class="info-box"><strong>Protokoll-Art:</strong> ${protocolTypeGerman}</div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:56px;">Bild</th>
            <th>Artikel</th>
            <th style="width:120px;">Größe</th>
            <th style="width:80px;">Menge</th>
          </tr>
        </thead>
        <tbody>
        ${groupedItems.map(item => {
          const thumb = item.imageUrl ? `<img class="thumb" src="${item.imageUrl}" alt="${item.name}">` : `<div class="thumb placeholder"></div>`;
          return `<tr><td>${thumb}</td><td class="item-name">${item.name}</td><td class="item-meta">${item.size || 'N/A'}</td><td>${item.quantity}</td></tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>
    <div class="cta">
      <p class="subtle" style="margin-bottom:12px;">Klicken Sie auf die Schaltfläche, um den Erhalt zu bestätigen:</p>
      <a href="${confirmationUrl}" class="button">Erhalt bestätigen</a>
    </div>
    <div class="meta">
      <div><strong>Gültig bis:</strong> ${expiresAt.toLocaleDateString('de-DE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })}</div>
      <div style="margin-top:6px;">Sie werden zur sicheren Authentifizierung zu Microsoft weitergeleitet.</div>
    </div>
    <div class="footer">
      Mit freundlichen Grüßen · Ihr Garderobe‑Team
    </div>
  </div>
</body>
</html>
    `.trim();

    return { to: '', subject, text, html };
  }

  async sendTestEmail(to: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com',
        to: to,
        subject: 'Garderobe System - Test Email',
        text: `Dies ist eine Test-Email vom Garderobe System.\n\nVersandt von: ${process.env.SMTP_FROM || process.env.SMTP_USER}\nZeit: ${new Date().toLocaleString('de-DE')}\n\nWenn Sie diese Email erhalten haben, ist die Email-Konfiguration korrekt.`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test Email</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .info { background: #e7f3ff; padding: 10px; border-left: 4px solid #2196F3; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧥 Garderobe System</h1>
      <p>Test Email erfolgreich</p>
    </div>
    <div class="content">
      <h2>Email-Test erfolgreich!</h2>
      <p>Diese Test-Email bestätigt, dass die Email-Konfiguration des Garderobe Systems ordnungsgemäß funktioniert.</p>
      
      <div class="info">
        <strong>📧 Versandt von:</strong> ${process.env.SMTP_FROM || process.env.SMTP_USER}<br>
        <strong>⏰ Zeit:</strong> ${new Date().toLocaleString('de-DE')}<br>
        <strong>🔧 SMTP Host:</strong> ${process.env.SMTP_HOST}
      </div>
      
      <p>Das System ist bereit für das Versenden von Bestätigungs-Emails an Mitarbeiter.</p>
    </div>
  </div>
</body>
</html>
        `,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Test email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Error sending test email:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('SMTP connection test failed:', error);
      return false;
    }
  }

  async sendEmail(options: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
    try {
      const { to, subject, html, text } = options;
      
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
        text: text || '',
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`[EMAIL SERVICE] Email sent successfully to ${to}:`, result.messageId);
      return true;
    } catch (error) {
      console.error('[EMAIL SERVICE] Error sending email:', error);
      return false;
    }
  }
}

// Singleton instance
export const emailService = new EmailService();