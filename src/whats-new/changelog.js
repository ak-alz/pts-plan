// Типы пунктов: 'new' | 'fix' | 'improve'

function images(glob) {
  return Object.values(glob);
}

export default [
  {
    version: '2.5',
    date: '2026-03-30',
    items: [
      {
        type: 'new',
        text: 'Редактирование заголовка задачи: кликните на название задачи, чтобы сразу переименовать её — Enter сохраняет, Escape отменяет',
      },
      {
        type: 'improve',
        text: 'Кнопка «Загрузить комментарии»: теперь загружает комментарии прямо на странице без перезагрузки. Количество настраивается в опциях (по умолчанию 50)',
      },
      {
        type: 'improve',
        text: 'Баннер с котами: добавлен провайдер CATAAS — работает с VPN. Выбор провайдера в настройках',
      },
    ],
    images: images(import.meta.glob('../assets/whats-new/2.5/*', {eager: true, import: 'default'})),
  },
  {
    version: '2.4.2',
    date: '2026-03-27',
    items: [
      {
        type: 'fix',
        text: 'Декомпозиция задачи: исправлено создание подзадач при открытии задачи через личный раздел (/company/personal/user/...)',
      },
      {
        type: 'improve',
        text: 'Таблица баллов спринта: загрузка и завершение задач переписаны на batch-запросы — время загрузки с ~5.5с до ~1.5с',
      },
      {
        type: 'improve',
        text: 'Сводка спринтов: загрузка данных переписана на Bitrix REST API',
      },
      {
        type: 'improve',
        text: 'Декомпозиция задачи: полный переход на официальный Bitrix REST API — создание подзадач через batch-запросы, стадия задаётся сразу при создании, участники и стадии загружаются через API вместо внутренних эндпоинтов и парсинга HTML',
      },
    ],
    images: [],
  },
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
