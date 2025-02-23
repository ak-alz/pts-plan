export default function getSettings(groupId, users = []) {
  const savedSettings = window.localStorage.getItem(`scrum-summary-settings-${groupId}`)
    ? JSON.parse(window.localStorage.getItem(`scrum-summary-settings-${groupId}`))
    : { users: {} };

  const result = {
    taskId: savedSettings.taskId || '',
    sprintsCount: savedSettings.sprintsCount || '',
    skipVacation: savedSettings.skipVacation || false,
    users: {},
  };

  // Собираем мапу вида [id пользователя]: true/false
  result.users = users
    .reduce((acc, { id }) => {
      acc[id] = savedSettings.users[id] || false;
      return acc;
    }, {});

  // Глубокое копирование для работы с Vue
  return JSON.parse(JSON.stringify(result));
}
