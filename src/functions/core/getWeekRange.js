export default function getWeekRange(offset) {
  const now = new Date();
  let currentDay = now.getDay();
  if (currentDay === 0) currentDay = 7; // Вс.
  const first = now.getDate() - currentDay + offset;
  const last = first + 6;

  const firstDay = new Date(now.setDate(first));

  const lastDay = new Date(now.setDate(last));

  const firstDayOptions = {
    day: 'numeric',
  };

  if (firstDay.getMonth() !== lastDay.getMonth()) {
    firstDayOptions.month = 'long';
  }

  return [
    firstDay.toLocaleDateString('ru-RU', firstDayOptions),
    lastDay.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
    }),
  ];
}
