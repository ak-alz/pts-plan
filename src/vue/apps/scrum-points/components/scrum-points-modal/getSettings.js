export default function getSettings(initialData, groupId) {
  const savedSettings = window.localStorage.getItem(`scrum-points-settings-${groupId}`)
    ? JSON.parse(window.localStorage.getItem(`scrum-points-settings-${groupId}`))
    : { columns: {}, users: {} };

  const result = {
    sprintNumber: savedSettings.sprintNumber || '',
    sprintFirstDate: savedSettings.sprintFirstDate || '1',
    showSummary: savedSettings.showSummary || false,
    showSummaryColumn: savedSettings.showSummaryColumn || false,
    showCopyButton: savedSettings.showCopyButton || false,
    showTasksCount: savedSettings.showTasksCount || false,
    showQuestion: savedSettings.showQuestion || false,
    showPlus: savedSettings.showPlus || false,
    showDetails: savedSettings.showDetails || false,
    compactMode: savedSettings.compactMode || false,
  };

  // Собираем мапу вида [id колонки]: true/false
  result.columns = initialData.columns
    .reduce((acc, { id }) => {
      acc[id] = savedSettings.columns[id] || false;
      return acc;
    }, {});

  // Получаем id всех пользователей из первоначальных данных
  const uniqueUsers = Array.from(new Set(initialData.items
    .map((item) => item.data.responsible.id)));

  // Собираем мапу вида [id пользователя]: true/false
  result.users = uniqueUsers
    .reduce((acc, id) => {
      acc[id] = savedSettings.users[id] || false;
      return acc;
    }, {});

  // Переключаем номер спринта, если с последнего раза поменялись даты
  if (result.sprintNumber && savedSettings.date) {
    const now = new Date().getTime();
    const diff = now - savedSettings.date;
    const weeks = Math.floor(diff / 1000 / 60 / 60 / 24 / 7);
    if (weeks > 0) {
      // Прибавляем число пропущенных недель к номеру спринта
      result.sprintNumber += weeks;

      window.localStorage.setItem(`scrum-points-settings-${groupId}`, JSON.stringify({
        ...result,
        date: now,
      }));
    }
  }

  // Глубокое копирование для работы с Vue
  return JSON.parse(JSON.stringify(result));
}
