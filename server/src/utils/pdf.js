import PDFDocument from "pdfkit";

export function streamInvoicePdf(invoice, res) {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${invoice.invoiceNumber}.pdf`);
  doc.pipe(res);

  doc.rect(0, 0, 595, 140).fill("#F8FAFC");
  doc.fillColor("#111827").fontSize(24).font("Helvetica-Bold").text(invoice.company?.name || "InvoiceFlow", 48, 48);
  doc.fillColor("#2563EB").fontSize(34).text("INVOICE", 410, 44, { align: "right" });
  doc.fillColor("#64748B").fontSize(10).text(invoice.invoiceNumber, 410, 84, { align: "right" });

  doc.fillColor("#111827").fontSize(12).font("Helvetica-Bold").text("Bill To", 48, 170);
  doc.font("Helvetica").fillColor("#475569").text(invoice.clientSnapshot?.name || "Client", 48, 190);
  doc.text(invoice.clientSnapshot?.email || "", 48, 207);
  doc.text(invoice.clientSnapshot?.address || "", 48, 224, { width: 220 });

  doc.fillColor("#111827").font("Helvetica-Bold").text("Details", 360, 170);
  doc.font("Helvetica").fillColor("#475569").text(`Issued: ${new Date(invoice.issueDate).toLocaleDateString()}`, 360, 190);
  doc.text(`Due: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "On receipt"}`, 360, 207);
  doc.text(`Status: ${invoice.status}`, 360, 224);

  let y = 290;
  doc.roundedRect(48, y - 18, 499, 30, 8).fill("#111827");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(10);
  doc.text("Item", 64, y - 8);
  doc.text("Qty", 300, y - 8);
  doc.text("Rate", 350, y - 8);
  doc.text("Tax", 420, y - 8);
  doc.text("Amount", 480, y - 8);

  doc.font("Helvetica").fillColor("#111827");
  y += 24;
  invoice.items?.forEach((item) => {
    const amount = Number(item.quantity || 0) * Number(item.price || 0);
    doc.text(item.name || "Service", 64, y, { width: 210 });
    doc.text(String(item.quantity || 0), 300, y);
    doc.text(`${invoice.currency} ${Number(item.price || 0).toFixed(2)}`, 350, y);
    doc.text(`${Number(item.tax || 0)}%`, 420, y);
    doc.text(`${invoice.currency} ${amount.toFixed(2)}`, 480, y);
    y += 28;
  });

  y += 24;
  doc.moveTo(330, y).lineTo(547, y).stroke("#E5E7EB");
  y += 16;
  [
    ["Subtotal", invoice.subtotal],
    ["Discount", -invoice.discountTotal],
    ["Tax", invoice.taxTotal],
    ["Total", invoice.total]
  ].forEach(([label, value], index) => {
    doc.font(index === 3 ? "Helvetica-Bold" : "Helvetica").fontSize(index === 3 ? 14 : 10);
    doc.fillColor(index === 3 ? "#111827" : "#475569").text(label, 350, y);
    doc.text(`${invoice.currency} ${Number(value || 0).toFixed(2)}`, 455, y, { align: "right" });
    y += 24;
  });

  doc.fillColor("#64748B").fontSize(10).text(invoice.notes || "Thank you for your business.", 48, 720, { width: 320 });
  doc.end();
}
