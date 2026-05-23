export const currencySymbols = {
  USD: "$",
  EUR: "EUR",
  INR: "Rs.",
  GBP: "GBP",
  AED: "AED"
};

export function calculateInvoice(items = []) {
  return items.reduce(
    (acc, item) => {
      const base = Number(item.quantity || 0) * Number(item.price || 0);
      const discount = base * (Number(item.discount || 0) / 100);
      const taxable = Math.max(base - discount, 0);
      const tax = taxable * (Number(item.tax || 0) / 100);
      return {
        subtotal: acc.subtotal + base,
        discountTotal: acc.discountTotal + discount,
        taxTotal: acc.taxTotal + tax,
        total: acc.total + taxable + tax
      };
    },
    { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 }
  );
}

export function formatMoney(value, currency = "USD") {
  return `${currencySymbols[currency] || currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
