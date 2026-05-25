import cron from "node-cron";
import Invoice from "../models/Invoice.js";
import Settings from "../models/Settings.js";
import { createMailer } from "../config/mail.js";

export function startScheduler() {
  cron.schedule("0 8 * * *", async () => {
    console.log("[Scheduler] Checking for overdue invoices...");
    try {
      const settings = await Settings.findOne({});
      const alertDays = settings?.notifications?.alertDaysBeforeDue ?? 3;
      const mailer = createMailer();
      if (!mailer) {
        console.log("[Scheduler] SMTP not configured, skipping email alerts.");
        return;
      }

      const now = new Date();
      const overdueResult = await Invoice.updateMany(
        {
          isDeleted: { $ne: true },
          status: { $in: ["Sent", "Pending"] },
          dueDate: { $lt: now }
        },
        { $set: { status: "Overdue" } }
      );
      console.log(`[Scheduler] Marked ${overdueResult.modifiedCount} invoices as Overdue`);

      if (alertDays > 0 && settings?.notifications?.overdueAlerts) {
        const alertDate = new Date(now);
        alertDate.setDate(alertDate.getDate() + alertDays);

        const upcomingInvoices = await Invoice.find({
          isDeleted: { $ne: true },
          status: { $in: ["Sent", "Pending"] },
          dueDate: {
            $gte: now,
            $lte: alertDate
          }
        });

        for (const invoice of upcomingInvoices) {
          const recipientEmail = invoice.clientSnapshot?.email;
          if (!recipientEmail) continue;
          const dueStr = new Date(invoice.dueDate).toLocaleDateString("en-IN");
          try {
            await mailer.sendMail({
              from: process.env.SMTP_FROM || process.env.SMTP_USER,
              to: recipientEmail,
              subject: `Payment Reminder: Invoice ${invoice.invoiceNumber} due on ${dueStr}`,
              html: `
                <p>Dear ${invoice.clientSnapshot?.name || "Valued Customer"},</p>
                <p>This is a friendly reminder that invoice <strong>${invoice.invoiceNumber}</strong>
                for <strong>${invoice.currency} ${Number(invoice.total || 0).toFixed(2)}</strong>
                is due on <strong>${dueStr}</strong>.</p>
                <p>Please make payment at your earliest convenience.</p>
                <p>Thank you.</p>
              `
            });
            console.log(`[Scheduler] Reminder sent to ${recipientEmail} for ${invoice.invoiceNumber}`);
          } catch (emailErr) {
            console.error(`[Scheduler] Failed to send reminder for ${invoice.invoiceNumber}:`, emailErr.message);
          }
        }
      }
    } catch (err) {
      console.error("[Scheduler] Error:", err.message);
    }
  });

  console.log("[Scheduler] Started - runs daily at 8:00 AM");
}
