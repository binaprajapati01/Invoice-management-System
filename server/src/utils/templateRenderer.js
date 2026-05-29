export function renderTemplate(htmlContent = "", invoice) {
  const items = invoice.items || [];
  const currency = escapeHtml(invoice.currency || "INR");
  const itemsTable = buildItemsTable(items, currency);

  const map = {
    "{{invoice.number}}": escapeHtml(invoice.invoiceNumber || ""),
    "{{invoice.date}}": invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString("en-IN") : "",
    "{{invoice.dueDate}}": invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "On receipt",
    "{{invoice.status}}": escapeHtml(invoice.status || ""),
    "{{invoice.currency}}": currency,
    "{{invoice.subtotal}}": Number(invoice.subtotal || 0).toFixed(2),
    "{{invoice.tax}}": Number(invoice.taxTotal || 0).toFixed(2),
    "{{invoice.discount}}": Number(invoice.discountTotal || 0).toFixed(2),
    "{{invoice.total}}": Number(invoice.total || 0).toFixed(2),
    "{{invoice.notes}}": escapeHtml(invoice.notes || ""),
    "{{invoice.terms}}": escapeHtml(invoice.terms || ""),
    "{{invoice.paymentTerms}}": escapeHtml(invoice.paymentTerms || ""),
    "{{client.name}}": escapeHtml(invoice.clientSnapshot?.name || ""),
    "{{client.email}}": escapeHtml(invoice.clientSnapshot?.email || ""),
    "{{client.address}}": escapeHtml(invoice.clientSnapshot?.address || ""),
    "{{client.taxId}}": escapeHtml(invoice.clientSnapshot?.taxId || ""),
    "{{company.name}}": escapeHtml(invoice.company?.name || ""),
    "{{company.email}}": escapeHtml(invoice.company?.email || ""),
    "{{company.address}}": escapeHtml(invoice.company?.address || ""),
    "{{company.logo}}": invoice.company?.logo ? `<img src="${escapeAttribute(invoice.company.logo)}" style="max-height:60px" />` : "",
    "{{company.signature}}": invoice.company?.signature ? `<img src="${escapeAttribute(invoice.company.signature)}" style="max-height:40px" />` : "",
    "{{bank.name}}": escapeHtml(invoice.bank?.bankName || ""),
    "{{bank.accountNo}}": escapeHtml(invoice.bank?.accountNo || ""),
    "{{bank.ifsc}}": escapeHtml(invoice.bank?.ifsc || ""),
    "{{bank.accountName}}": escapeHtml(invoice.bank?.accountName || ""),
    "{{payment.qr}}": invoice.qrPaymentUrl ? `<img src="${escapeAttribute(invoice.qrPaymentUrl)}" style="width:80px;height:80px" />` : "",
    "{{items.table}}": itemsTable
  };

  let html = htmlContent;
  for (const [key, value] of Object.entries(map)) {
    html = html.replaceAll(key, value);
  }
  return html;
}

function buildItemsTable(items, currency) {
  const rows = items.map((item) => {
    const base = Number(item.quantity || 0) * Number(item.price || 0);
    const discount = base * (Number(item.discount || 0) / 100);
    const taxable = Math.max(base - discount, 0);
    const amount = taxable + taxable * (Number(item.tax || 0) / 100);
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(item.name || "")}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${escapeHtml(item.quantity || 0)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${currency} ${Number(item.price || 0).toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${escapeHtml(item.tax || 0)}%</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${currency} ${amount.toFixed(2)}</td>
    </tr>`;
  }).join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#111827;color:#fff">
      <th style="padding:10px 8px;text-align:left">Item</th>
      <th style="padding:10px 8px">Qty</th>
      <th style="padding:10px 8px;text-align:right">Rate</th>
      <th style="padding:10px 8px;text-align:right">Tax</th>
      <th style="padding:10px 8px;text-align:right">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
