import getTaskPoints from '@/functions/core/getTaskPoints';

export default function usersDataAdapter(items) {
  const result = {};

  items.forEach((item) => {
    const responsibleId = item.data.responsible.id;
    const { columnId } = item;

    const task = {
      id: item.id,
      name: item.data.name,
      points: getTaskPoints(item.data.name),
    };

    // Создаем юзера, если еще не создали
    if (!result[responsibleId]) {
      result[responsibleId] = {
        id: item.data.responsible.id,
        name: item.data.responsible.name,
        photo: item.data.responsible.photo.src,
        url: item.data.responsible.url,
        columns: {},
      };
    }

    // Создаём колонку, если еще не создали
    if (!result[responsibleId].columns[columnId]) {
      result[responsibleId].columns[columnId] = [];
    }

    result[responsibleId].columns[columnId].push(task);
  });

  // Из объекта делаем массив + глубокое копирование для работы с Vue
  return JSON.parse(JSON.stringify(
    Object.values(result).sort((a, b) => a.name.localeCompare(b.name)),
  ));
}
