export function formatCurrency(value, currency = "KES") {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatKg(value) {
  return `${new Intl.NumberFormat("en-KE").format(value ?? 0)} kg`;
}

