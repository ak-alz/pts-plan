import {NOTIF_TYPES} from './actions/notification-details/notifTypes.js';
import {getColors} from './utils.js';

export const optionTypes = {
  TEXT: 'text',
  NUMBER: 'number',
  COLOR: 'color',
  SELECT: 'select',
  RADIO: 'radio',
  MULTISELECT: 'multiselect',
};

export const groups = [
  { key: 'appearance', label: 'Оформление' },
  { key: 'profile', label: 'Профиль' },
  { key: 'tasks', label: 'Задачи' },
  { key: 'notifications', label: 'Уведомления' },
  { key: 'analytics', label: 'Аналитика' },
];

export default [
  {
    key: 'userFirstName',
    name: 'Имя',
    tip: 'Ваше имя в Bitrix24 (нужно для некоторых фич)',
    groups: ['profile'],
    type: optionTypes.TEXT,
  },
  {
    key: 'userLastName',
    name: 'Фамилия',
    tip: 'Ваша фамилия в Bitrix24 (нужно для некоторых фич)',
    groups: ['profile'],
    type: optionTypes.TEXT,
  },
  {
    key: 'userId',
    name: 'ID пользователя',
    tip: 'Ваш ID в Bitrix24 (нужно для некоторых фич)',
    groups: ['profile'],
    type: optionTypes.NUMBER,
  },
  {
    key: 'pixelToolsApiKey',
    name: 'AI API ключ',
    tip: 'API ключ для AI-функций (декомпозиция задач)',
    groups: ['profile'],
    type: optionTypes.TEXT,
  },
  {
    key: 'userNameColor',
    name: 'Подсветка своих упоминаний в комментариях',
    tip: 'Делает упоминания с вами заметными. Необходимо указать ID пользователя',
    groups: ['appearance'],
    popularity: 95,
    needs: ['userId'],
    action: async ({options}) => {
      const {userNameColor} = await import('/src/js/actions/user-name-color');
      userNameColor(options);
    },
    options: [
      {
        key: 'userNameColorColor',
        name: 'Цвет текста',
        default: getColors('violet', '500'),
        presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '500'),
        demo: 'comment',
        type: optionTypes.COLOR,
      },
      {
        key: 'userNameColorBorder',
        name: 'Цвет рамки',
        default: getColors('violet', '500'),
        presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '500'),
        demo: 'comment',
        type: optionTypes.COLOR,
      },
      {
        key: 'userNameColorBackground',
        name: 'Цвет фона',
        default: getColors('violet', '50'),
        presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '50'),
        demo: 'comment',
        type: optionTypes.COLOR,
      },
    ],
  },
  {
    key: 'newCommentColor',
    name: 'Подсветка новых комментариев',
    tip: 'Меняет заливку непрочитанных комментариев в задачах',
    groups: ['appearance'],
    popularity: 50,
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
        demo: 'comment-new',
        type: optionTypes.COLOR,
      },
    ],
  },
  {
    key: 'tagAllColor',
    name: 'Подсветка TAGALL в комментариях',
    tip: 'Делает метку TAGALL в комментариях более заметной',
    groups: ['appearance'],
    popularity: 95,
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
        demo: 'comment',
        type: optionTypes.COLOR,
      },
    ],
  },
  {
    key: 'quoteColor',
    name: 'Стиль цитат в комментариях и задачах',
    tip: 'Меняет фон и рамку у цитат в комментариях и задачах',
    groups: ['appearance'],
    popularity: 40,
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
        demo: 'comment-quote',
        type: optionTypes.COLOR,
      },
      {
        key: 'quoteColorBorder',
        name: 'Цвет рамки',
        default: getColors('teal', '200'),
        presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '200'),
        demo: 'comment-quote',
        type: optionTypes.COLOR,
      },
    ],
  },
  {
    key: 'taskSearch',
    name: 'Поиск задач в канбане (виджет)',
    tip: 'Добавляет кнопку «Поиск» в канбане для поиска задач по названию, постановщику, исполнителю и датам',
    new: true,
    groups: ['tasks'],
    popularity: 90,
    action: async ({sessionId}) => {
      const {taskSearch} = await import('/src/js/actions/task-search');
      taskSearch(sessionId);
    },
  },
  {
    key: 'quickTask',
    name: 'Быстрое создание задачи (виджет)',
    tip: 'Заменяет стандартную форму «Быстрая задача» в колонках канбана на собственное окно с выбором исполнителя',
    new: true,
    groups: ['tasks'],
    popularity: 90,
    action: async ({sessionId}) => {
      const {quickTask} = await import('/src/js/actions/quick-task');
      quickTask(sessionId);
    },
  },
  {
    key: 'scrumPoints',
    name: 'Таблица баллов за текущий спринт (виджет)',
    tip: 'Добавляет счётчик story points в канбан-доске.',
    groups: ['analytics'],
    popularity: 75,
    action: async ({sessionId}) => {
      const {scrumPoints} = await import('/src/js/actions/scrum-points');
      scrumPoints(sessionId);
    },
  },
  {
    key: 'sprintHistory',
    name: 'История завершенных задач (виджет)',
    tip: 'Добавляет кнопку для просмотра завершённых задач за произвольный период с фильтром по исполнителю и сортировкой по баллам',
    groups: ['tasks'],
    popularity: 60,
    action: async ({sessionId}) => {
      const {sprintHistory} = await import('/src/js/actions/sprint-history');
      sprintHistory(sessionId);
    },
  },
  {
    key: 'scrumSummary',
    name: 'Сводка по итогам спринтов (виджет)',
    tip: 'Показывает итоги по завершённым спринтам в канбане',
    groups: ['analytics'],
    popularity: 55,
    action: async ({sessionId}) => {
      const {scrumSummary} = await import('/src/js/actions/scrum-summary');
      scrumSummary(sessionId);
    },
  },
  {
    key: 'taskAnalysis',
    name: 'Анализ баллов задач (виджет)',
    tip: 'Показывает суммарные баллы по деревьям задач: находит все подзадачи любой вложенности, суммирует баллы и выводит таблицу по корневым задачам',
    new: true,
    groups: ['analytics'],
    popularity: 55,
    action: async ({sessionId, options}) => {
      const {taskAnalysis} = await import('/src/js/actions/task-analysis');
      taskAnalysis(sessionId, options);
    },
  },
  {
    key: 'decomposeTask',
    name: 'Быстрое создание подзадач (виджет)',
    tip: 'Добавляет кнопку для быстрого создания подзадач с исполнителями и стадиями',
    groups: ['tasks'],
    popularity: 85,
    action: async ({sessionId}) => {
      const {decomposeTask} = await import('/src/js/actions/decompose-task');
      decomposeTask(sessionId);
    },
  },
  {
    key: 'editTaskTitle',
    name: 'Быстрое переименование задачи кликом',
    tip: 'Позволяет кликнуть на заголовок задачи и сразу переименовать её, без перехода в режим редактирования',
    groups: ['tasks'],
    popularity: 85,
    action: async ({sessionId, options}) => {
      const {editTaskTitle} = await import('/src/js/actions/edit-task-title');
      editTaskTitle(sessionId, options);
    },
    options: [
      {
        key: 'editTaskTitleDoubleClick',
        name: 'Редактирование на двойной клик',
        tip: 'Вместо одного клика для начала редактирования требуется двойной.',
      },
    ],
  },
  {
    key: 'commitButton',
    name: 'Кнопка копирования названия коммита',
    tip: 'Добавляет кнопку, которая генерирует готовое название коммита из заголовка задачи',
    groups: ['tasks'],
    popularity: 70,
    action: () => {
      import('/src/js/actions/commit-button');
    },
  },
  {
    key: 'exportTask',
    name: 'Экспорт задачи',
    tip: 'Кнопка для копирования или скачивания заголовка, описания и комментариев задачи (в буфер, .txt или .zip с вложениями)',
    groups: ['tasks'],
    popularity: 45,
    new: true,
    action: async ({ sessionId }) => {
      const { exportTask } = await import('/src/js/actions/export-task');
      exportTask(sessionId);
    },
  },
  {
    key: 'fixLinks',
    name: 'Не обрезать длинные ссылки',
    tip: 'Автоматически возвращает длинные ссылки в описание и комментарии',
    groups: ['tasks'],
    popularity: 70,
    action: () => {
      import('/src/js/actions/fix-links');
    },
  },
  {
    key: 'showComments',
    name: 'Кнопка загрузки комментариев задачи',
    tip: 'Добавляет кнопку для пакетной загрузки комментариев в задаче без перезагрузки страницы',
    groups: ['tasks'],
    popularity: 75,
    action: async ({ options }) => {
      const { showComments } = await import('/src/js/actions/show-comments');
      showComments(options.showCommentsCount);
    },
    options: [
      {
        key: 'showCommentsCount',
        name: 'Количество комментариев',
        tip: 'Сколько комментариев загружать за один раз. Округляется до кратного 10, так как Bitrix загружает по 10 штук за запрос.',
        type: optionTypes.SELECT,
        choices: [
          {label: '20', value: 20},
          {label: '30', value: 30},
          {label: '50', value: 50},
          {label: '100', value: 100},
          {label: '200', value: 200},
          {label: '500', value: 500},
        ],
        default: 50,
        width: '90px',
      },
    ],
  },
  {
    key: 'notificationDetails',
    name: 'Детали и подсветка уведомлений',
    tip: 'Подгружает и показывает группу, стадию, исполнителя и постановщика прямо в каждом уведомлении о задаче',
    new: true,
    groups: ['notifications'],
    popularity: 85,
    action: async ({sessionId, options}) => {
      const {notificationDetails} = await import('/src/js/actions/notification-details');
      notificationDetails(sessionId, options);
    },
    options: [
      {
        key: 'notificationDetailsCompact',
        name: 'Компактные уведомления',
        tip: 'Скрывает кнопку «Ответить» и убирает ограничения ширины в уведомлениях',
      },
      {
        key: 'notificationDetailsHighlight',
        name: 'Подсвечивать, если исполнитель',
        tip: 'Выделяет уведомления, в которых вы являетесь исполнителем. Необходимо указать ID пользователя.',
        needs: ['userId'],
        options: [
          {
            key: 'notificationDetailsHighlightBorder',
            name: 'Цвет рамки',
            default: getColors('violet', '400'),
            presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '400'),
            demo: 'notification-assignee',
            type: optionTypes.COLOR,
          },
          {
            key: 'notificationDetailsHighlightBackground',
            name: 'Цвет фона',
            default: getColors('violet', '50'),
            presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '50'),
            demo: 'notification-assignee',
            type: optionTypes.COLOR,
          },
        ],
      },
      {
        key: 'notificationDetailsHighlightCreator',
        name: 'Подсвечивать, если постановщик',
        tip: 'Выделяет уведомления, в которых вы являетесь постановщиком. Необходимо указать ID пользователя.',
        needs: ['userId'],
        options: [
          {
            key: 'notificationDetailsHighlightCreatorBorder',
            name: 'Цвет рамки',
            default: getColors('amber', '400'),
            presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '400'),
            demo: 'notification-creator',
            type: optionTypes.COLOR,
          },
          {
            key: 'notificationDetailsHighlightCreatorBackground',
            name: 'Цвет фона',
            default: getColors('amber', '50'),
            presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '50'),
            demo: 'notification-creator',
            type: optionTypes.COLOR,
          },
        ],
      },
      {
        key: 'notificationDetailsHighlightMention',
        name: 'Подсвечивать, если упомянут',
        tip: 'Выделяет уведомления, в тексте которых есть ваше имя или TAGALL. Необходимо указать имя и фамилию.',
        needs: ['userFirstName', 'userLastName'],
        options: [
          {
            key: 'notificationDetailsHighlightMentionBorder',
            name: 'Цвет рамки',
            default: getColors('teal', '400'),
            presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '400'),
            demo: 'notification-mention',
            type: optionTypes.COLOR,
          },
          {
            key: 'notificationDetailsHighlightMentionBackground',
            name: 'Цвет фона',
            default: getColors('teal', '50'),
            presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '50'),
            demo: 'notification-mention',
            type: optionTypes.COLOR,
          },
        ],
      },
      {
        key: 'notificationDetailsHighlightTagall',
        name: 'Подсвечивать, если tagall',
        tip: 'Выделяет уведомления, в тексте которых упомянуты «все участники задачи» (tagall)',
        options: [
          {
            key: 'notificationDetailsHighlightTagallBorder',
            name: 'Цвет рамки',
            default: getColors('red', '500'),
            presets: getColors(['red', 'orange', 'amber', 'violet', 'fuchsia', 'pink', 'rose'], '500'),
            demo: 'notification-tagall',
            type: optionTypes.COLOR,
          },
          {
            key: 'notificationDetailsHighlightTagallBackground',
            name: 'Цвет фона',
            default: getColors('red', '50'),
            presets: getColors(['red', 'orange', 'amber', 'violet', 'fuchsia', 'pink', 'rose'], '50'),
            demo: 'notification-tagall',
            type: optionTypes.COLOR,
          },
        ],
      },
      {
        key: 'notificationDetailsHighlightTagallStatus',
        name: 'Подсвечивать статусные tagall',
        tip: 'Выделяет tagall-уведомления, сообщающие о готовности или деплое (готово, в проде, выкатил, задеплоил и т. п.). Перехватывает приоритет над обычным tagall.',
        options: [
          {
            key: 'notificationDetailsHighlightTagallStatusBorder',
            name: 'Цвет рамки',
            default: getColors('green', '500'),
            presets: getColors(['green', 'lime', 'teal', 'emerald', 'cyan', 'blue', 'violet', 'amber'], '500'),
            demo: 'notification-tagall',
            type: optionTypes.COLOR,
          },
          {
            key: 'notificationDetailsHighlightTagallStatusBackground',
            name: 'Цвет фона',
            default: getColors('green', '50'),
            presets: getColors(['green', 'lime', 'teal', 'emerald', 'cyan', 'blue', 'violet', 'amber'], '50'),
            demo: 'notification-tagall',
            type: optionTypes.COLOR,
          },
        ],
      },
      {
        key: 'notificationDetailsDimTypes',
        name: 'Приглушить типы',
        tip: 'Уведомления выбранных типов будут отображаться с уменьшенной непрозрачностью. Подсвеченные уведомления не приглушаются.',
        type: optionTypes.MULTISELECT,
        default: [],
        choices: NOTIF_TYPES.filter(({dimmable}) => dimmable !== false).map(({label}) => ({label, value: label})),
      },
    ],
  },
  {
    key: 'removeNotifications',
    name: 'Кнопка удаления уведомлений задачи',
    tip: 'Добавляет кнопку для удаления всех уведомлений задачи',
    groups: ['notifications'],
    popularity: 30,
    action: async ({sessionId}) => {
      const {removeNotifications} = await import('/src/js/actions/remove-notifications');
      removeNotifications(sessionId);
    },
  },
  {
    key: 'removeSystemNotifications',
    name: 'Кнопка очистки уведомлений',
    tip: 'Добавляет кнопку для удаления системных уведомлений. Виды удаляемых уведомлений настраиваются галочками ниже.',
    groups: ['notifications'],
    popularity: 75,
    action: async ({sessionId, options}) => {
      const {removeSystemNotifications} = await import('/src/js/actions/remove-system-notifications');
      removeSystemNotifications(sessionId, options);
    },
    options: [
      {
        key: 'removeSystemNotificationsSystem',
        name: 'Системная иконка',
        tip: 'Удаляет уведомления, у которых вместо аватарки системная иконка (серый колокольчик).',
      },
      {
        key: 'removeSystemNotificationsChanges',
        name: 'Изменения задач',
        tip: 'Удаляет уведомления вида «Изменил(а) задачу» и «Изменена задача».',
      },
      {
        key: 'removeSystemNotificationsClosed',
        name: 'Закрытия задач',
        tip: 'Удаляет уведомления вида «Закрыл(а) задачу».',
      },
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
        tip: 'Удаляет уведомления вида «Отреагировал(а) на ваш комментарий» и «Благодарит вас в сообщении».',
      },
    ],
  },
  {
    key: 'autoChoiceUser',
    name: 'Автовыбор при упоминании через «+»',
    tip: 'При добавлении упоминания через «+» автоматически выбирает пользователя, если поиск выдал только один результат.',
    popularity: 10,
    action: () => {
      import('/src/js/actions/auto-choice-user');
    },
  },
  {
    key: 'invisibleMentions',
    name: 'Подсветка неработающих упоминаний',
    tip: 'Подсвечивает пользователей, не добавленных в задачу. Подсвечивает комментарии без упоминаний в первых 100 символах.',
    groups: ['tasks'],
    popularity: 80,
    action: () => {
      import('/src/js/actions/invisible-mentions');
    },
  },
  {
    key: 'groupTitle',
    name: 'Название проекта в <title>',
    tip: 'Добавляет название текущего проекта/группы в <title> браузерной вкладки для быстрого поиска среди открытых вкладок.',
    popularity: 10,
    action: () => {
      import('/src/js/actions/group-title');
    },
  },
  {
    key: 'closeNotifications',
    name: 'Автозакрытие чужих уведомлений',
    tip: 'Автоматически закрывает уведомления, в которых вас не упомянули. Необходимо указать имя и фамилию пользователя.',
    groups: ['notifications'],
    popularity: 80,
    needs: ['userFirstName', 'userLastName'],
    action: async ({options}) => {
      const {closeNotifications} = await import('/src/js/actions/close-notifications');
      closeNotifications(options.userFirstName, options.userLastName);
    },
  },
  {
    key: 'kanbanUserCards',
    name: 'Подсветка своих задач в канбане',
    tip: 'Меняет фон карточек в канбане. Необходимо указать имя и фамилию пользователя.',
    groups: ['appearance'],
    popularity: 50,
    needs: ['userFirstName', 'userLastName'],
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
    name: 'Маркеры стадий в задаче',
    tip: 'Добавляет сокращённые буквы в ячейки стадий внутри задачи для быстрой навигации без наведения курсора.',
    groups: ['tasks'],
    popularity: 80,
    action: () => {
      import('/src/js/actions/status-markers');
    },
  },
  {
    key: 'openInNewTab',
    name: 'Действия в новой вкладке',
    tip: 'Открывает выбранные действия с задачами в новой вкладке.',
    popularity: 10,
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
    key: 'autoAuditor',
    name: 'Все наблюдатели при создании задач',
    tip: 'При открытии формы создания новой задачи или подзадачи автоматически нажимает кнопку добавления наблюдателя',
    popularity: 50,
    action: () => {
      import('/src/js/actions/auto-auditor');
    },
  },
  {
    key: 'showCats',
    name: 'Баннер с котами',
    tip: 'Добавляет баннер с котами в боковое меню (10 случайных фото меняются каждые 6 минут)',
    popularity: 10,
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
