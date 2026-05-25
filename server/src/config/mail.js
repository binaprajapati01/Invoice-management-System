import nodemailer from "nodemailer";

export function createMailer(settings) {
  const emailSettings = settings?.emailSettings || {};
  const host = emailSettings.smtpHost || process.env.SMTP_HOST;
  const port = Number(emailSettings.smtpPort || process.env.SMTP_PORT || 587);
  const user = emailSettings.smtpUser || process.env.SMTP_USER;
  const pass = emailSettings.smtpPassword || process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });
}

export function getFromAddress(settings) {
  const emailSettings = settings?.emailSettings || {};
  const fromEmail = emailSettings.fromEmail || process.env.SMTP_FROM || process.env.SMTP_USER;
  const fromName = emailSettings.fromName;
  if (!fromName) return fromEmail;
  return `"${String(fromName).replaceAll('"', '\\"')}" <${fromEmail}>`;
}
