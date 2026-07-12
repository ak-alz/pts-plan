// Конфиг быстрой настройки: вопросы и привязка фич к ответам.
// Источник правды для подбора — здесь. Новую фичу добавляем в нужный вопрос или вариант ответа.
// `step.features` — показываем всем, кто ответил на вопрос; `option.features` — только при выборе варианта.
// `step.default` — предвыбранный ответ (значение для radio, массив для чекбоксов).
// `step.visibleIf(answers)` / `option.visibleIf(answers)` — необязательный предикат: показываем, только когда вернёт true.
// `option.needs` — массив профильных полей; вариант скрыт, пока они не заполнены (как needs у фич).

const steps = [
  {
    id: 'profile',
    type: 'profile',
  },
  {
    id: 'role',
    question: 'Чем вы занимаетесь?',
    type: 'single',
    default: 'basic',
    // Базовые улучшения работы с задачами — полезны всем, не зависят от роли и раздела.
    features: ['decomposeTask', 'editTaskTitle', 'showComments', 'statusMarkers', 'invisibleMentions', 'fixLinks', 'worktimeEnd'],
    options: [
      { label: 'Разработчик', value: 'developer', description: 'Пишете код, работаете с git', features: ['commitButton', 'kanbanCommitButton', 'tagallButton', 'exportTask'] },
      { label: 'Руководитель / аналитик', value: 'management', description: 'Ставите задачи, следите за спринтами и метриками команды', features: ['exportGroupTasks'] },
      { label: 'И то, и другое', value: 'both', description: 'И разработка, и планирование с аналитикой', features: ['commitButton', 'kanbanCommitButton', 'tagallButton', 'exportTask', 'exportGroupTasks'] },
      { label: 'Просто работаю с задачами', value: 'basic', description: 'Ведёте свои задачи: комментарии, статусы, подзадачи', features: [] },
    ],
  },
  {
    id: 'surfaces',
    question: 'Чем из Битрикса пользуетесь?',
    hint: 'То, что не используете, не появится.',
    type: 'multi',
    default: ['notifications'],
    options: [
      { label: 'Канбан-доска', value: 'kanban', description: 'Доска задач с колонками по стадиям', features: ['taskSearch', 'quickTask', 'kanbanCommitButton', 'tagallButton'] },
      { label: 'Панель уведомлений', value: 'notifications', description: 'Колокольчик и всплывающие оповещения Битрикса', features: ['notificationDetails', 'removeSystemNotifications', 'closeNotifications', 'removeNotifications', 'osNotifications'] },
      { label: 'Работа с задачами и комментариями', value: 'automation', description: 'Автовыбор при упоминании через «+», наблюдатели по умолчанию при создании задачи, автоподстановка названия подзадачи, редирект на просмотр после создания задачи, действия в новой вкладке, название группы во вкладке браузера', features: ['autoChoiceUser', 'autoAuditor', 'autoTaskTitle', 'redirectAfterTaskCreate', 'openInNewTab', 'groupTitle'] },
    ],
  },
  {
    id: 'scrum',
    // Все скрам-фичи — виджеты канбана, без него вопрос бессмысленен.
    visibleIf: answers => answers.surfaces?.includes('kanban'),
    question: 'Как устроены спринты в команде?',
    hint: 'Если работаете без скрама — пропустите.',
    type: 'multi',
    options: [
      { label: 'Баллы в названии задачи', value: 'points', description: 'Сложность прописана в названии, например «Исправить баг | 5»', features: ['scrumPoints', 'taskAnalysis', 'sprintHistory'] },
      { label: 'Итоги спринта в общей задаче', value: 'sprintSummary', description: 'Результаты каждого спринта пишутся комментарием в одну задачу', features: ['scrumSummary'] },
      { label: 'Приоритеты в Google Таблице', value: 'googleSheet', description: 'Список приоритетов задач ведётся в гугл-таблице', features: ['sprintPriorities'] },
    ],
  },
  {
    id: 'appearance',
    question: 'Что подсветить в интерфейсе?',
    hint: 'Цвета потом можно будет настроить.',
    type: 'multi',
    default: ['mentions', 'tagall'],
    options: [
      { label: 'Свои упоминания в комментариях', value: 'mentions', description: 'Выделяет комментарии, где упомянули вас или написали TAGALL', needs: ['userId'], features: ['userNameColor'] },
      { label: 'TAGALL в комментариях', value: 'tagall', description: 'Заметнее обращения ко всем участникам задачи', features: ['tagAllColor'] },
      { label: 'Новые комментарии', value: 'newComments', description: 'Подсвечивает непрочитанные комментарии', features: ['newCommentColor'] },
      { label: 'Свои задачи в канбане', value: 'myCards', description: 'Подсвечивает карточки, где вы исполнитель', visibleIf: answers => answers.surfaces?.includes('kanban'), needs: ['userFirstName', 'userLastName'], features: ['kanbanUserCards'] },
      { label: 'Цитаты', value: 'quotes', description: 'Свой цвет фона и рамки у цитат', features: ['quoteColor'] },
    ],
  },
];

export default steps;
