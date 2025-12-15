import { getColors } from './utils.js';

export const optionTypes = {
  TEXT: 'text',
  NUMBER: 'number',
  COLOR: 'color',
};

export default [
  {
    key: 'userName',
    name: 'Имя пользователя',
    tip: 'Ваше имя в Bitrix24 (нужно для некоторых фич)',
    type: optionTypes.TEXT,
  },
  {
    key: 'userId',
    name: 'ID пользователя',
    tip: 'Ваш ID в Bitrix24 (нужен для некоторых фич)',
    type: optionTypes.NUMBER,
  },
  {
    key: 'userNameColor',
    name: 'Цвет вашего имени',
    tip: 'Делает ваше имя в комментариях цветным. Необходимо указать ID пользователя',
    disabled: (options) => !options.userId,
    action: async ({ options }) => {
      const { userNameColor } = await import('/src/js/actions/user-name-color');
      userNameColor(options.userId, options.userNameColorColor);
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
    ],
  },
  {
    key: 'mentionColor',
    name: 'Рамка при упоминании',
    tip: 'Подсвечивает цветной рамкой комментарии, где вас упомянули. Необходимо указать ID пользователя',
    new: true,
    disabled: (options) => !options.userId,
    action: async ({ options }) => {
      const { mentionColor } = await import('/src/js/actions/mention-color');
      mentionColor(options.userId, options.mentionColorBorder);
    },
    options: [
      {
        key: 'mentionColorBorder',
        name: 'Цвет рамки',
        default: getColors('violet', '500'),
        presets: getColors(['green', 'lime', 'red', 'amber', 'teal', 'blue', 'violet', 'fuchsia'], '500'),
        demo: true,
        type: optionTypes.COLOR,
      },
    ],
  },
  {
    key: 'newCommentColor',
    name: 'Фон новых комментариев',
    tip: 'Меняет заливку непрочитанных комментариев в задачах',
    action: async ({ options }) => {
      const { newCommentColor } = await import('/src/js/actions/new-comment-color');
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
    action: async ({ options }) => {
      const { tagAllColor } = await import('/src/js/actions/tag-all-color');
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
    action: async ({ options }) => {
      const { quoteColor } = await import('/src/js/actions/quote-color');
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
    key: 'scrumPoints',
    name: 'Таблица баллов спринта',
    tip: 'Добавляет счётчик story points в канбан-доске',
    new: true,
    action: async ({ sessionId }) => {
      const { scrumPoints } = await import('/src/js/actions/scrum-points');
      scrumPoints(sessionId);
    },
  },
  {
    key: 'scrumSummary',
    name: 'Сводка спринтов',
    tip: 'Показывает итоги по завершённым спринтам в канбане',
    new: true,
    action: async ({ sessionId }) => {
      const { scrumSummary } = await import('/src/js/actions/scrum-summary');
      scrumSummary(sessionId);
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
    name: 'Кнопка «Все комментарии»',
    tip: 'Добавляет кнопку для загрузки всех комментариев в задаче',
    action: () => {
      import('/src/js/actions/show-comments');
    },
  },
  {
    key: 'showCats',
    name: 'Баннер с котами',
    tip: 'Добавляет баннер с котами в боковое меню (работает с VPN, 10 случайных фото меняются каждые 6 минут)',
    action: () => {
      import('/src/js/actions/show-cats');
    },
  },
];
