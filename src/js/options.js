import {getColors} from './utils.js';

export const optionTypes = {
  TEXT: 'text',
  NUMBER: 'number',
  COLOR: 'color',
  SELECT: 'select',
  RADIO: 'radio',
};

export default [
  {
    key: 'userFirstName',
    name: 'Имя',
    tip: 'Ваше имя в Bitrix24 (нужно для некоторых фич)',
    type: optionTypes.TEXT,
  },
  {
    key: 'userLastName',
    name: 'Фамилия',
    tip: 'Ваша фамилия в Bitrix24 (нужно для некоторых фич)',
    type: optionTypes.TEXT,
  },
  {
    key: 'userId',
    name: 'ID пользователя',
    tip: 'Ваш ID в Bitrix24 (нужно для некоторых фич)',
    type: optionTypes.NUMBER,
  },
  {
    key: 'userNameColor',
    name: 'Заметные упоминания',
    tip: 'Делает упоминания с вами заметными. Необходимо указать ID пользователя',
    new: true,
    disabled: (options) => !options.userId,
    action: async ({options}) => {
      const {userNameColor} = await import('/src/js/actions/user-name-color');
      userNameColor(options.userId, options.userNameColorColor, options.userNameColorBorder, options.userNameColorBackground);
    },
    options: [
      {
        key: 'userNameColorColor',
        name: 'Цвет текста',
        default: getColors('violet', '500'),
        presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '500'),
        demo: true,
        type: optionTypes.COLOR,
      },
      {
        key: 'userNameColorBorder',
        name: 'Цвет рамки',
        default: getColors('violet', '500'),
        presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '500'),
        demo: true,
        type: optionTypes.COLOR,
      },
      {
        key: 'userNameColorBackground',
        name: 'Цвет фона',
        default: getColors('violet', '50'),
        presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '50'),
        demo: true,
        type: optionTypes.COLOR,
      },
    ],
  },
  {
    key: 'newCommentColor',
    name: 'Фон новых комментариев',
    tip: 'Меняет заливку непрочитанных комментариев в задачах',
    action: async ({options}) => {
      const {newCommentColor} = await import('/src/js/actions/new-comment-color');
      newCommentColor(options.newCommentColorBackground);
    },
    options: [
      {
        key: 'newCommentColorBackground',
        name: 'Цвет фона',
        default: getColors('lime', '50'),
        presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '50'),
        demo: true,
        type: optionTypes.COLOR,
      },
    ],
  },
  {
    key: 'tagAllColor',
    name: 'Цвет TAGALL',
    tip: 'Делает метку TAGALL в комментариях более заметной',
    action: async ({options}) => {
      const {tagAllColor} = await import('/src/js/actions/tag-all-color');
      tagAllColor(options.tagAllColorColor);
    },
    options: [
      {
        key: 'tagAllColorColor',
        name: 'Цвет текста',
        default: getColors('red', '500'),
        presets: getColors(['red', 'orange', 'amber', 'violet', 'fuchsia', 'pink', 'rose'], '500'),
        demo: true,
        type: optionTypes.COLOR,
      },
    ],
  },
  {
    key: 'quoteColor',
    name: 'Оформление цитат',
    tip: 'Меняет фон и рамку у цитат в комментариях и задачах',
    action: async ({options}) => {
      const {quoteColor} = await import('/src/js/actions/quote-color');
      quoteColor(options.quoteColorBackground, options.quoteColorBorder);
    },
    options: [
      {
        key: 'quoteColorBackground',
        name: 'Цвет фона',
        default: getColors('teal', '50'),
        presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '50'),
        demo: true,
        type: optionTypes.COLOR,
      },
      {
        key: 'quoteColorBorder',
        name: 'Цвет рамки',
        default: getColors('teal', '200'),
        presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '200'),
        demo: true,
        type: optionTypes.COLOR,
      },
    ],
  },
  {
    key: 'taskSearch',
    name: 'Поиск по задачам',
    tip: 'Добавляет кнопку «Поиск» в канбане для поиска задач по названию, постановщику, исполнителю и датам',
    new: true,
    action: async ({sessionId}) => {
      const {taskSearch} = await import('/src/js/actions/task-search');
      taskSearch(sessionId);
    },
  },
  {
    key: 'scrumPoints',
    name: 'Таблица баллов спринта',
    tip: 'Добавляет счётчик story points в канбан-доске.',
    new: true,
    action: async ({sessionId}) => {
      const {scrumPoints} = await import('/src/js/actions/scrum-points');
      scrumPoints(sessionId);
    },
  },
  {
    key: 'sprintHistory',
    name: 'История спринта',
    tip: 'Добавляет кнопку для просмотра завершённых задач за произвольный период с фильтром по исполнителю и сортировкой по баллам',
    new: true,
    action: async ({sessionId}) => {
      const {sprintHistory} = await import('/src/js/actions/sprint-history');
      sprintHistory(sessionId);
    },
  },
  {
    key: 'scrumSummary',
    name: 'Сводка спринтов',
    tip: 'Показывает итоги по завершённым спринтам в канбане',
    new: true,
    action: async ({sessionId}) => {
      const {scrumSummary} = await import('/src/js/actions/scrum-summary');
      scrumSummary(sessionId);
    },
  },
  {
    key: 'decomposeTask',
    name: 'Декомпозиция задачи',
    tip: 'Добавляет кнопку для быстрого создания подзадач с исполнителями и стадиями. Необходимо указать ID пользователя',
    new: true,
    disabled: (options) => !options.userId,
    action: async ({sessionId, options}) => {
      const {decomposeTask} = await import('/src/js/actions/decompose-task');
      decomposeTask(sessionId, options.userId);
    },
  },
  {
    key: 'editTaskTitle',
    name: 'Редактирование заголовка задачи',
    tip: 'Позволяет кликнуть на заголовок задачи и сразу переименовать её, без перехода в режим редактирования',
    new: true,
    action: async ({sessionId}) => {
      const {editTaskTitle} = await import('/src/js/actions/edit-task-title');
      editTaskTitle(sessionId);
    },
  },
  {
    key: 'commitButton',
    name: 'Кнопка названия коммита',
    tip: 'Добавляет кнопку, которая генерирует готовое название коммита из заголовка задачи',
    new: true,
    action: () => {
      import('/src/js/actions/commit-button');
    },
  },
  {
    key: 'fixLinks',
    name: 'Не обрезать длинные ссылки',
    tip: 'Автоматически возвращает длинные ссылки в описание и комментарии',
    action: () => {
      import('/src/js/actions/fix-links');
    },
  },
  {
    key: 'showComments',
    name: 'Кнопка «Загрузить комментарии»',
    tip: 'Добавляет кнопку для пакетной загрузки комментариев в задаче без перезагрузки страницы',
    action: async ({ options }) => {
      const { showComments } = await import('/src/js/actions/show-comments');
      showComments(options.showCommentsCount);
    },
    options: [
      {
        key: 'showCommentsCount',
        name: 'Количество комментариев',
        tip: 'Сколько комментариев загружать за один раз. Округляется до кратного 10, так как Bitrix загружает по 10 штук за запрос.',
        type: optionTypes.NUMBER,
        default: 50,
        width: '80px',
      },
    ],
  },
  {
    key: 'removeNotifications',
    name: 'Кнопка «Удалить уведомления»',
    tip: 'Добавляет кнопку для удаления всех уведомлений задачи',
    action: async ({sessionId}) => {
      const {removeNotifications} = await import('/src/js/actions/remove-notifications');
      removeNotifications(sessionId);
    },
  },
  {
    key: 'removeSystemNotifications',
    name: 'Кнопка «Удалить системные уведомления»',
    tip: 'Добавляет кнопку для удаления всех системных уведомлений. Например: все сообщения с серым колокольчиком; сообщения, которые начинаются на «Изменил(а) задачу» и на «Закрыл(а) задачу».',
    new: true,
    action: async ({sessionId, options}) => {
      const {removeSystemNotifications} = await import('/src/js/actions/remove-system-notifications');
      removeSystemNotifications(sessionId, {
        dedupe: options.removeSystemNotificationsDedupe,
        removeNew: options.removeSystemNotificationsNew,
        removeReactions: options.removeSystemNotificationsReactions,
      });
    },
    options: [
      {
        key: 'removeSystemNotificationsDedupe',
        name: 'Дубли (!!!)',
        tip: 'Для каждой задачи оставляет только последнее уведомление, остальные удаляет. Осторожно: среди дублей могут быть важные упоминания.',
      },
      {
        key: 'removeSystemNotificationsNew',
        name: 'Новые задачи',
        tip: 'Удаляет уведомления вида «Добавил(а) новую задачу».',
      },
      {
        key: 'removeSystemNotificationsReactions',
        name: 'Реакции',
        tip: 'Удаляет уведомления вида «Отреагировал(а) на ваш комментарий».',
      },
    ],
  },
  {
    key: 'autoChoiceUser',
    name: 'Автовыбор единственного пользователя',
    tip: 'При добавлении упоминания через «+» автоматически выбирает пользователя, если поиск выдал только один результат.',
    action: () => {
      import('/src/js/actions/auto-choice-user');
    },
  },
  {
    key: 'invisibleMentions',
    name: 'Неработающие упоминания',
    tip: 'Подсвечивает пользователей, не добавленных в задачу. Подсвечивает комментарии без упоминаний в первых 100 символах.',
    action: () => {
      import('/src/js/actions/invisible-mentions');
    },
  },
  {
    key: 'groupTitle',
    name: 'Название проекта в <title>',
    tip: 'Добавляет название текущего проекта/группы в <title> браузерной вкладки для быстрого поиска среди открытых вкладок.',
    action: () => {
      import('/src/js/actions/group-title');
    },
  },
  {
    key: 'closeNotifications',
    name: 'Автозакрытие чужих уведомлений',
    tip: 'Автоматически закрывает уведомления, в которых вас не упомянули. Необходимо указать имя и фамилию пользователя.',
    disabled: (options) => !options.userFirstName || !options.userLastName,
    action: async ({options}) => {
      const {closeNotifications} = await import('/src/js/actions/close-notifications');
      closeNotifications(options.userFirstName, options.userLastName);
    },
  },
  {
    key: 'kanbanUserCards',
    name: 'Фон карточек исполнителя',
    tip: 'Меняет фон карточек в канбане. Необходимо указать имя и фамилию пользователя.',
    new: true,
    disabled: (options) => !options.userFirstName || !options.userLastName,
    action: async ({options}) => {
      const {kanbanUserCards} = await import('/src/js/actions/kanban-user-cards');
      kanbanUserCards(options.kanbanUserCardBackground, options.userFirstName, options.userLastName);
    },
    options: [
      {
        key: 'kanbanUserCardBackground',
        name: 'Цвет фона',
        default: getColors('green', '100'),
        presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '100'),
        type: optionTypes.COLOR,
      },
    ],
  },
  {
    key: 'statusMarkers',
    name: 'Маркеры стадий',
    tip: 'Добавляет сокращённые буквы в ячейки стадий внутри задачи для быстрой навигации без наведения курсора.',
    new: true,
    action: () => {
      import('/src/js/actions/status-markers');
    },
  },
  {
    key: 'openInNewTab',
    name: 'Действия в новой вкладке',
    tip: 'Открывает выбранные действия с задачами в новой вкладке.',
    action: async ({options}) => {
      const {openInNewTab} = await import('/src/js/actions/open-in-new-tab');
      openInNewTab(options);
    },
    options: [
      {
        key: 'openInNewTabCreate',
        name: 'Создать задачу',
        tip: 'В канбане кнопка «Создать задачу» открывает форму в новой вкладке.',
        default: true,
      },
      {
        key: 'openInNewTabEdit',
        name: 'Редактировать задачу',
        tip: 'При нажатии «Редактировать» задача открывается в новой вкладке.',
        default: true,
      },
      {
        key: 'openInNewTabCopy',
        name: 'Копировать задачу',
        tip: 'Копирование задачи открывается в новой вкладке.',
      },
      {
        key: 'openInNewTabSubtask',
        name: 'Добавить подзадачу',
        tip: 'Создание подзадачи открывается в новой вкладке.',
      },
    ],
  },
  {
    key: 'showCats',
    name: 'Баннер с котами',
    tip: 'Добавляет баннер с котами в боковое меню (10 случайных фото меняются каждые 6 минут)',
    action: async ({options}) => {
      const {showCats} = await import('/src/js/actions/show-cats');
      showCats(options);
    },
    options: [
      {
        key: 'showCatsProvider',
        type: optionTypes.RADIO,
        default: 'thecatapi',
        choices: [
          {label: 'The Cat API (нужен VPN)', value: 'thecatapi'},
          {label: 'Cat as a service (нужен VPN)', value: 'cataas'},
        ],
      },
    ],
  },
];
