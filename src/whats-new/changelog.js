// Типы пунктов: 'new' | 'fix' | 'improve'

function images(glob) {
  return Object.values(glob);
}

export default [
  {
    version: '2.4',
    date: '2026-03-24',
    items: [
      {type: 'new', text: 'Открытие задач в новой вкладке'},
      {type: 'improve', text: 'Улучшения декомпозиции'},
      {type: 'improve', text: 'Расширен список типов уведомлений для удаления'},
    ],
    images: images(import.meta.glob('../assets/whats-new/2.4/*', {eager: true, import: 'default'})),
  },
  {
    version: '2.3',
    date: '2026-02-21',
    items: [
      {type: 'new', text: 'Декомпозиция задач — быстрое создание подзадач прямо из карточки задачи'},
    ],
    images: images(import.meta.glob('../assets/whats-new/2.3/*', {eager: true, import: 'default'})),
  },
  {
    version: '2.2',
    date: '2026-01-30',
    items: [
      {type: 'new', text: 'Фон карточек исполнителя в канбане'},
      {type: 'new', text: 'Маркеры стадий на карточках'},
      {type: 'improve', text: 'Отображение участников без задач в спринте'},
      {type: 'fix', text: 'Фикс коротких названий колонок в скрам-сводке'},
    ],
    images: images(import.meta.glob('../assets/whats-new/2.2/*', {eager: true, import: 'default'})),
  },
  {
    version: '2.1',
    date: '2025-12-19',
    items: [
      {type: 'improve', text: 'Автовыбор пользователя при поиске'},
      {type: 'improve', text: 'Автозакрытие лишних уведомлений'},
      {type: 'improve', text: 'Подсветка неработающих упоминаний'},
      {type: 'improve', text: 'Название проекта во вкладке браузера'},
    ],
    images: [],
  },
  {
    version: '2.0',
    date: '2025-12-15',
    items: [
      {type: 'new', text: 'Полный перезапуск расширения на Vue 3 + PrimeVue + Tailwind'},
      {type: 'new', text: 'Попап управления функциями'},
      {type: 'new', text: 'Оптимизация'},
      {type: 'new', text: 'Скрам-баллы и скрам-сводка'},
      {type: 'new', text: 'Копировать текст коммита из названия задачи'},
      {type: 'new', text: 'Кнопка удаления уведомлений'},
      {type: 'improve', text: 'Подсветка упоминаний, цитат и тегов'},
    ],
    images: images(import.meta.glob('../assets/whats-new/2.0/*', {eager: true, import: 'default'})),
  },
];
