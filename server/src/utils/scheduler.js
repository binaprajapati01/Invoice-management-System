import cron from "node-cron";
import Invoice from "../models/Invoice.js";
import Settings from "../models/Settings.js";
import { createMailer, getFromAddress } from "../config/mail.js";
import { logActivity } from "./logActivity.js";

const schedulerReq = { user: null, ip: "scheduler" };

export function startScheduler() {
  cron.schedule("0 0 * * *", markOverdueInvoices);
  cron.schedule("0 9 * * *", sendDueSoonReminders);
  console.log("[Scheduler] Started - overdue check at 00:00, reminders at 09:00");
}

async function markOverdueInvoices() {
  console.log("[Scheduler] Checking for overdue invoices...");
  try {
    const today = startOfToday();
    const invoices = await Invoice.find({
      isDeleted: false,
      status: { $in: ["Sent", "Pending"] },
      dueDate: { $lt: today }
    });

    for (const invoice of invoices) {
      invoice.status = "Overdue";
      await invoice.save();
      await logActivity(schedulerReq, "Marked invoice overdue", "Invoice", invoice._id, {
        invoiceNumber: invoice.invoiceNumber
      });
    }

    console.log(`[Scheduler] Marked ${invoices.length} invoices as Overdue`);
  } catch (error) {
    console.error("[Scheduler] Overdue check failed:", error.message);
  }
}

async function sendDueSoonReminders() {
  console.log("[Scheduler] Checking for upcoming invoice due dates...");
  try {
    const settings = await Settings.findOne({});
    const alertDays = settings?.notifications?.alertDaysBeforeDue ?? 3;
    if (settings?.notifications?.overdueAlerts === false) {
      console.log("[Scheduler] Overdue reminders disabled, skipping.");
      return;
    }

    const mailer = createMailer(settings);
    if (!mailer) {
      console.log("[Scheduler] SMTP not configured, skipping reminders.");
      return;
    }

    const today = startOfToday();
    const alertDate = new Date(today);
    alertDate.setDate(alertDate.getDate() + Number(alertDays || 3));

    const invoices = await Invoice.find({
      isDeleted: false,
      status: { $in: ["Sent", "Pending"] },
      dueDate: { $gte: today, $lte: endOfDay(alertDate) }
    }).populate("client", "name email");

    for (const invoice of invoices) {
      const clientEmail = invoice.client?.email || invoice.clientSnapshot?.email;
      if (!clientEmail) continue;

      const placeholders = buildPlaceholders(invoice);
      const subject = replaceTemplate(
        settings?.emailSettings?.subjectTemplate || "Payment reminder for invoice {{invoiceNumber}}",
        placeholders
      );
      const body = replaceTemplate(
        settings?.emailSettings?.bodyTemplate || defaultReminderTemplate(),
        placeholders
      );

      try {
        await mailer.sendMail({
          from: getFromAddress(settings),
          to: clientEmail,
          subject,
          html: body
        });
        await logActivity(schedulerReq, "Sent overdue reminder", "Invoice", invoice._id, {
          invoiceNumber: invoice.invoiceNumber,
          to: clientEmail
        });
        console.log(`[Scheduler] Reminder sent to ${clientEmail} for ${invoice.invoiceNumber}`);
      } catch (error) {
        console.error(`[Scheduler] Failed to send reminder for ${invoice.invoiceNumber}:`, error.message);
      }
    }
  } catch (error) {
    console.error("[Scheduler] Reminder job failed:", error.message);
  }
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function buildPlaceholders(invoice) {
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "On receipt";
  return {
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client?.name || invoice.clientSnapshot?.name || "Client",
    total: `${invoice.currency || "INR"} ${Number(invoice.total || 0).toFixed(2)}`,
    dueDate
  };
}

function replaceTemplate(template, values) {
  return String(template || "").replace(/{{\s*(invoiceNumber|clientName|total|dueDate)\s*}}/g, (_match, key) => values[key] || "");
}

function defaultReminderTemplate() {
  return [
    "<p>Hello {{clientName}},</p>",
    "<p>This is a friendly reminder that invoice <strong>{{invoiceNumber}}</strong> for <strong>{{total}}</strong> is due on <strong>{{dueDate}}</strong>.</p>",
    "<p>Please make payment at your earliest convenience.</p>"
  ].join("");
}
