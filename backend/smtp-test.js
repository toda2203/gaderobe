const nodemailer = require('nodemailer');
require('dotenv').config();

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: 'daniel@troks.de',
      subject: 'SMTP Testmail von Gaderobe',
      text: 'Dies ist eine Testmail vom Gaderobe-System. SMTP funktioniert!',
    });
    console.log('Testmail erfolgreich gesendet:', info);
  } catch (err) {
    console.error('Fehler beim Senden der Testmail:', err);
  }
}

main();
