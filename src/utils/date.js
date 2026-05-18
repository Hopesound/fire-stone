export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDateKeys(endDate, rangeDays) {
  const keys = [];
  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    keys.push(toDateInput(addDays(endDate, -i)));
  }
  return keys;
}

export function formatAcqTime(value) {
  if (!value) {
    return "";
  }
  const padded = String(value).padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}
