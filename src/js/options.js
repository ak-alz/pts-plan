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
    tip: '<p>Выделяет ваше имя жирным в комментариях задач и подсвечивает весь комментарий цветом, если вас упомянули или написали TAGALL.</p><p>Необходимо указать ID пользователя.</p>',
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
    tip: '<p>Меняет цвет фона непрочитанных комментариев в задачах — делает их заметнее на фоне обычных.</p>',
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
    tip: '<p>Выделяет цветом TAGALL в комментариях задачи, чтобы такие сообщения было легче заметить.</p>',
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
    tip: '<p>Меняет цвет фона и рамки у цитат в комментариях и описании задачи — стандартный серый заменяется на выбранный вами.</p>',
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
    tip: '<p>Добавляет кнопку «Поиск» в канбане. Ищет задачи по названию, постановщику, исполнителю и датам создания/изменения.</p><p>Можно фильтровать по статусу, типу (корневые/подзадачи) и текущей группе, а также включить поиск по тексту описания и комментариев.</p><p>Внутри виджета есть настройки.</p>',
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
    tip: '<p>Заменяет стандартную форму создания задачи в колонках канбана на собственный диалог «Быстрая задача» с выбором исполнителя и наблюдателей.</p><p>Внутри виджета есть настройки.</p>',
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
    tip: '<p>Добавляет кнопку «Scrum» в канбане. Показывает таблицу баллов за текущий спринт: сколько очков у каждого исполнителя в каждой колонке.</p><p>Отдельная фича внутри — кнопка завершения всех задач в колонке одним кликом, очень удобно при закрытии спринта.</p><p>Внутри виджета есть настройки.</p>',
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
    tip: '<p>Добавляет кнопку «История» в канбане для просмотра завершённых задач за произвольный период.</p><p>Можно фильтровать по исполнителю, исключать хотфиксы и группировать задачи по родительской — удобно смотреть, что сделано в рамках конкретного спринта. Баллы считаются автоматически из названия задачи.</p>',
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
    tip: '<p>Добавляет кнопку «Scrum-сводка» в канбане. Актуально для команд, где итоги каждого спринта публикуются в комментариях одной задачи — виджет читает эти комментарии и строит таблицу и график баллов по участникам за выбранный период.</p><p>Внутри виджета есть настройки.</p>',
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
    tip: '<p>Добавляет кнопку «Анализ» в канбане. Загружает завершённые задачи выбранных участников за период, суммирует баллы и группирует по корневым задачам. Баллы извлекаются из названия задачи по формату «Название | Баллы». Есть вкладки: сводка по участникам, динамика по неделям, топ задач и распределение по размерам.</p><p>Внутри виджета есть настройки.</p>',
    groups: ['analytics'],
    popularity: 55,
    action: async ({sessionId, options}) => {
      const {taskAnalysis} = await import('/src/js/actions/task-analysis');
      taskAnalysis(sessionId, options);
    },
  },
  {
    key: 'sprintPriorities',
    name: 'Приоритеты спринта (виджет)',
    tip: '<p>Добавляет кнопку «Приоритеты» в канбане. Актуально для команд, где руководитель ведёт список приоритетов задач в Google Таблице — виджет читает её и помогает составить спринт: задачи отображаются в порядке приоритета с актуальными данными из Bitrix (колонка, исполнитель, постановщик).</p><p>Дополнительно показывает таблицу команды с количеством баллов у каждого участника — удобно понимать, кому ещё нужно добавить задачи, а у кого уже достаточно.</p><p>Внутри виджета есть настройки.</p>',
    new: true,
    groups: ['analytics'],
    popularity: 60,
    action: async ({sessionId}) => {
      const {sprintPriorities} = await import('/src/js/actions/sprint-priorities');
      sprintPriorities(sessionId);
    },
  },
  {
    key: 'decomposeTask',
    name: 'Быстрое создание подзадач (виджет)',
    tip: '<p>Добавляет кнопку «Декомпозировать задачу» внутри задачи. Открывает диалог, в котором можно создать несколько подзадач за один раз — у каждой свои название, исполнитель и стадия. Есть AI-режим: виджет сам предлагает список подзадач на основе названия и описания задачи.</p><p>Внутри виджета есть настройки.</p>',
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
    tip: '<p>Позволяет кликнуть на заголовок задачи и сразу переименовать его прямо на месте — без перехода в режим редактирования. Enter сохраняет, Esc отменяет.</p>',
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
        default: true,
        tip: 'Вместо одного клика для начала редактирования требуется двойной.',
      },
    ],
  },
  {
    key: 'commitButton',
    name: 'Кнопка копирования названия коммита',
    tip: '<p>Добавляет кнопку «Копировать текст коммита» рядом с заголовком задачи. По клику копирует в буфер строку формата «Название задачи | ID» — готовое название для git-коммита.</p>',
    groups: ['tasks'],
    popularity: 70,
    action: () => {
      import('/src/js/actions/commit-button');
    },
  },
  {
    key: 'kanbanCommitButton',
    name: 'Кнопка копирования названия коммита в канбане',
    tip: '<p>Добавляет кнопку «Копировать текст коммита» в панель управления каждой карточки на канбан-доске. По клику копирует в буфер строку формата «Название задачи | ID» — готовое название для git-коммита.</p>',
    new: true,
    groups: ['tasks'],
    popularity: 70,
    action: () => {
      import('/src/js/actions/kanban-commit-button');
    },
  },
  {
    key: 'exportTask',
    name: 'Экспорт задачи (виджет)',
    tip: '<p>Добавляет кнопку «Экспортировать задачу» рядом с заголовком задачи. Позволяет выгрузить полный контекст задачи — в буфер обмена, файлом .txt или архивом .zip.</p><p>При экспорте в ZIP все файловые вложения из описания и комментариев сохраняются в архив, а ссылки в тексте автоматически заменяются на корректные локальные пути.</p><p>Особенно полезно при работе с ИИ-агентами — передайте контекст задачи в чат или проект, чтобы агент мог самостоятельно разобраться в задаче и помочь с её решением.</p>',
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
    tip: '<p>Bitrix автоматически обрезает длинные ссылки в описании и комментариях, заменяя конец на «...». Эта фича восстанавливает полный адрес — теперь его можно прочитать целиком.</p>',
    groups: ['tasks'],
    popularity: 70,
    action: () => {
      import('/src/js/actions/fix-links');
    },
  },
  {
    key: 'showComments',
    name: 'Кнопка загрузки комментариев задачи',
    tip: '<p>Добавляет кнопку загрузки комментариев в задаче — загружает настраиваемое количество сразу вместо стандартных 10. Количество можно изменить в настройках.</p>',
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
    tip: '<p>К каждому уведомлению о задаче автоматически подгружает и показывает группу, стадию, исполнителя и постановщика — без необходимости открывать задачу.</p><p>Уведомления подсвечиваются цветом в зависимости от вашей роли: исполнитель, постановщик, упомянутый, TAGALL. Остальные можно приглушить.</p><p>Внутри виджета есть настройки.</p>',
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
        default: true,
      },
      {
        key: 'notificationDetailsTransformText',
        name: 'Выделять TAGALL и упоминания в тексте',
        tip: 'Заменяет в тексте уведомления «[Имя Фамилия] и другие участники задачи» на жирный TAGALL, а ваши упоминания выделяет жирным. Имя выделяется только если заданы имя и фамилия.',
        default: true,
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
        default: true,
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
        default: true,
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
        key: 'notificationDetailsDim',
        name: 'Приглушить остальные',
        tip: 'Уведомления без подсветки будут отображаться с уменьшенной непрозрачностью.',
        default: true,
      },
    ],
  },
  {
    key: 'removeNotifications',
    name: 'Кнопка удаления уведомлений задачи',
    tip: '<p>Добавляет кнопку «Удалить уведомления» внутри задачи. Удаляет все уведомления по этой задаче одним кликом.</p>',
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
    tip: '<p>Добавляет кнопку «Удалить системные уведомления» в панель уведомлений. Удаляет выбранные типы уведомлений одним кликом — системные (с иконкой колокольчика), об изменениях и закрытиях задач, о новых задачах, реакциях и дублях по одной задаче.</p>',
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
        default: true,
      },
      {
        key: 'removeSystemNotificationsChanges',
        name: 'Изменения задач',
        tip: 'Удаляет уведомления вида «Изменил(а) задачу» и «Изменена задача».',
        default: true,
      },
      {
        key: 'removeSystemNotificationsClosed',
        name: 'Закрытия задач',
        tip: 'Удаляет уведомления вида «Закрыл(а) задачу».',
        default: true,
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
        default: true,
      },
    ],
  },
  {
    key: 'autoChoiceUser',
    excludeFromSetup: true,
    name: 'Автовыбор при упоминании через «+»',
    tip: '<p>При добавлении упоминания через «+» в комментарии автоматически выбирает пользователя, если поиск выдал только один результат — не нужно кликать вручную.</p>',
    popularity: 10,
    action: () => {
      import('/src/js/actions/auto-choice-user');
    },
  },
  {
    key: 'invisibleMentions',
    name: 'Подсветка неработающих упоминаний',
    tip: '<p>Упоминание пользователя в комментарии работает только если он добавлен в задачу. Эта фича подсвечивает иконкой предупреждения «неработающие» упоминания, а также комментарии без упоминаний участников задачи в первых 100 символах.</p>',
    groups: ['tasks'],
    popularity: 80,
    action: () => {
      import('/src/js/actions/invisible-mentions');
    },
  },
  {
    key: 'groupTitle',
    excludeFromSetup: true,
    name: 'Название проекта в <title>',
    tip: '<p>Дописывает название текущего проекта в заголовок браузерной вкладки. Удобно смотреть к какой группе относится открытая задача, не глядя на содержимое страницы.</p>',
    popularity: 10,
    action: () => {
      import('/src/js/actions/group-title');
    },
  },
  {
    key: 'closeNotifications',
    name: 'Автозакрытие чужих уведомлений',
    tip: '<p>Автоматически закрывает всплывающие уведомления, в которых вас не упомянули. Оставляет только те, где есть ваше имя или TAGALL.</p><p>Необходимо указать имя и фамилию.</p>',
    groups: ['notifications'],
    popularity: 80,
    needs: ['userFirstName', 'userLastName'],
    action: async ({options}) => {
      const {closeNotifications} = await import('/src/js/actions/close-notifications');
      closeNotifications(options.userFirstName, options.userLastName, options);
    },
    options: [
      {
        key: 'closeNotificationsTransformText',
        name: 'Выделять TAGALL и упоминания в тексте',
        tip: 'Заменяет в тексте всплывающего уведомления «[Имя Фамилия] и другие участники задачи» на жирный TAGALL, а ваше имя выделяет жирным.',
        default: true,
      },
    ],
  },
  {
    key: 'kanbanUserCards',
    name: 'Подсветка своих задач в канбане',
    tip: '<p>Подсвечивает карточки задач в канбане, в которых вы являетесь исполнителем, — выбранным цветом фона.</p><p>Необходимо указать имя и фамилию.</p>',
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
    tip: '<p>В задаче показывает первую букву названия каждой стадии прямо в ячейке полосы статусов — не нужно наводить курсор чтобы понять, какая стадия где.</p>',
    groups: ['tasks'],
    popularity: 80,
    action: () => {
      import('/src/js/actions/status-markers');
    },
  },
  {
    key: 'openInNewTab',
    excludeFromSetup: true,
    name: 'Действия в новой вкладке',
    tip: '<p>Открывает выбранные действия с задачами в новой вкладке вместо текущей — редактирование, создание задачи, копирование, создание подзадачи. Спасает от ситуации, когда форма открывается поверх страницы и случайное закрытие уничтожает всё, что успели написать.</p>',
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
    excludeFromSetup: true,
    name: 'Все наблюдатели при создании задач',
    tip: '<p>При открытии формы создания задачи автоматически добавляет всех участников группы в наблюдатели — не нужно выбирать их вручную каждый раз.</p>',
    popularity: 50,
    action: () => {
      import('/src/js/actions/auto-auditor');
    },
  },
  {
    key: 'showCats',
    excludeFromSetup: true,
    name: 'Баннер с котами',
    tip: '<p>Добавляет баннер с котом в нижнюю часть бокового меню. Фото меняется каждые 6 минут — если понравилось, кликните чтобы открыть исходное изображение в новой вкладке и скачать. Требуется VPN.</p>',
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
          {label: 'HTTP Cats (нужен VPN)', value: 'httpcat'},
        ],
      },
    ],
  },
  {
    key: 'screenBlur',
    excludeFromSetup: true,
    name: 'Блюр данных для записи экрана',
    tip: '<p>Размывает текстовые данные на странице: заголовки задач в канбане, описание задачи, комментарии, текст уведомлений и чатов. Удобно при демонстрации экрана или записи видео, когда не хочется показывать рабочие данные.</p>',
    popularity: 0,
    action: () => {
      import('/src/js/actions/screen-blur');
    },
  },
];
