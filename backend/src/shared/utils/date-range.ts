const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type DateRange = {
  start: Date;
  end: Date;
};

function getBrazilDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Nao foi possivel calcular a data no fuso do Brasil.");
  }

  return { year, month, day };
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

export function toBrazilDate(date: Date) {
  const { year, month, day } = getBrazilDateParts(date);
  return new Date(`${year}-${month}-${day}T00:00:00-03:00`);
}

export function getTodayRangeInBrazil(reference = new Date()): DateRange {
  const start = toBrazilDate(reference);
  return { start, end: addDays(start, 1) };
}

export function getLast7DaysRangeInBrazil(reference = new Date()): DateRange {
  const today = toBrazilDate(reference);
  return { start: addDays(today, -6), end: addDays(today, 1) };
}

export function getLast30DaysRangeInBrazil(reference = new Date()): DateRange {
  const today = toBrazilDate(reference);
  return { start: addDays(today, -29), end: addDays(today, 1) };
}

export function getWeekdayLabelInBrazil(date: Date) {
  return date
    .toLocaleDateString("pt-BR", { weekday: "short", timeZone: BRAZIL_TIME_ZONE })
    .replace(".", "")
    .toUpperCase();
}

export function getHourInBrazil(date: Date) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: BRAZIL_TIME_ZONE,
    hour: "2-digit",
    hour12: false
  }).format(date);

  return Number(hour);
}
