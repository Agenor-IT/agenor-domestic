import { argentinaDate } from './argentinaDate';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const [currentYear, currentMonth] = argentinaDate().split('-').map(Number);

export const INITIAL_MONTHS = Array.from({ length: 17 }, (_, index) => {
  const offset = currentMonth - 1 + index;
  return `${MONTH_NAMES[offset % 12]}-${String(currentYear + Math.floor(offset / 12)).slice(-2)}`;
});
