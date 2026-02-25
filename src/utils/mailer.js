const nodemailer = require('nodemailer');

let cachedTransporter = null;

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = buildTransporter();
  return cachedTransporter;
}

async function sendPasswordReset({ to, username, link }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('[mailer] Missing SMTP config; password reset link:', link);
    return;
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@tvstalker.local',
    to,
    subject: 'TVStalker password reset',
    html: `Hello ${username || ''}!<br/>Use this link to reset your password:<br/><a href="${link}">${link}</a><br/>This link can be used once.`
  });
}

module.exports = { sendPasswordReset };
