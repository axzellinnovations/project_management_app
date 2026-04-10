export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const startOfWeek = (date: Date) => {
  const d = startOfDay(date);
  const day = d.getDay();
  return addDays(d, -day);
};

export const endOfWeek = (date: Date) => addDays(startOfWeek(date), 6);

export const startOfMonthGrid = (date: Date) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return addDays(first, -first.getDay());
};

export const endOfMonthGrid = (date: Date) => {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return addDays(last, 6 - last.getDay());
};

export const toDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const isDateInRange = (date: Date, start?: string, end?: string) => {
  const startDate = toDate(start);
  const endDate = toDate(end);

  if (!startDate && !endDate) return false;

  const dateStart = startOfDay(date).getTime();
  const left = startDate ? startOfDay(startDate).getTime() : Number.MIN_SAFE_INTEGER;
  const right = endDate ? endOfDay(endDate).getTime() : Number.MAX_SAFE_INTEGER;

  return dateStart >= left && dateStart <= right;
};

export const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export const formatWeekLabel = (date: Date) => {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  const left = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const right = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${left} - ${right}`;
};
