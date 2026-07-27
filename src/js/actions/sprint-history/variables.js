import dayjs from 'dayjs';

export const PERIOD_OPTIONS = [
  {label: 'Предыдущая неделя', value: 'prevWeek'},
  {label: 'Текущая неделя', value: 'currentWeek'},
];

export const ROOT_STATUS_OPTIONS = [
  {label: 'Все', value: 'all'},
  {label: 'Завершённые', value: 'closed'},
  {label: 'Не завершённые', value: 'open'},
];

/**
 * Возвращает диапазон дат для пресета периода — предыдущая календарная неделя (пн-вс) или
 * текущая (с понедельника по сегодня).
 * @param {'prevWeek'|'currentWeek'} period
 * @returns {[Date, Date]}
 */
export function getPeriodRange(period) {
  const today = dayjs();
  const dayOfWeek = today.day(); // 0 — воскресенье, 1 — понедельник … 6 — суббота
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = today.subtract(daysSinceMonday, 'day').startOf('day');

  if (period === 'currentWeek') {
    return [thisMonday.toDate(), today.toDate()];
  }

  return [thisMonday.subtract(7, 'day').toDate(), thisMonday.subtract(1, 'day').toDate()];
}
