export function calculateInvoice(items = []) {
  return items.reduce(
    (acc, item) => {
      const base = Number(item.quantity || 0) * Number(item.price || 0);
      const discount = base * (Number(item.discount || 0) / 100);
      const taxable = Math.max(base - discount, 0);
      const tax = taxable * (Number(item.tax || 0) / 100);
      acc.subtotal += base;
      acc.discountTotal += discount;
      acc.taxTotal += tax;
      acc.total += taxable + tax;
      return acc;
    },
    { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 }
  );
}
