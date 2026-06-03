import BitrixApi from '../../BitrixApi.js';
import {
  NOTIF_NEW_TASK_RE,
  NOTIF_QUOTE_RE,
  NOTIF_QUOTE_STRIP_RE,
  NOTIF_REACTION_RE,
  TAGALL_NAMED_RE,
  TAGALL_STATUS_RE,
} from '../../patterns.js';
import {getTaskIdFromUrl, insertCSS, rehydrateOnChanges, stringToPastelColor} from '../../utils.js';
import {NOTIF_TYPES} from './notifTypes.js';

const SELECTORS = {
  container: '.bx-im-content-notification__elements',
  newItem: '.bx-im-content-notification-item__container[data-id]:not([data-pts-details])',
  anyItem: '.bx-im-content-notification-item__container',
  taskLink: 'a[href*="/tasks/task/view/"]',
  titleContainer: '.bx-im-content-notification-item-header__title-container',
  contentText: '.bx-im-content-notification-item-content__content-text',
};

// Канонический токен, на который заменяется tagall-фраза (для детекции и для жирной метки в тексте)
const TAGALL_TOKEN = 'TAGALL';
const DEFAULT_STAGE_COLOR = '#888888';

const BASE_CSS = `
  .bx-im-content-notification-item-header__title-container {
    max-width: none !important;
    width: 100%;
  }
  .pts-nd {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-left: auto;
    padding-left: 8px;
    flex-shrink: 0;
    align-items: center;
  }
  .pts-nd-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    background: #f0f0f0;
    color: #333;
    font-size: 11px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pts-nd-stage-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .pts-nd-avatar {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .pts-nd-initials {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 7px;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
  }
  [data-pts-dimmed] {
    opacity: 0.5;
  }
  .pts-nd-skeleton {
    height: 16px;
    width: 100px;
    border-radius: 4px;
    background: linear-gradient(90deg, #ebebeb 25%, #f8f8f8 50%, #ebebeb 75%);
    background-size: 200% 100%;
    animation: pts-nd-shimmer 1.2s ease-in-out infinite;
    margin-left: auto;
    flex-shrink: 0;
  }
  @keyframes pts-nd-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .bx-im-content-notification-item__container:has(> .pts-nd-icon) {
    position: relative;
  }
  .pts-nd-icon {
    position: absolute;
    top: 4px;
    left: 5px;
    font-size: 11px !important;
    line-height: 1;
    z-index: 2;
    pointer-events: none;
    text-shadow: 0 0 2px #fff, 0 0 2px #fff;
  }
`;

const COMPACT_CSS = `
  .bx-im-content-notification-quick-answer__container {
    display: none !important;
  }
  .bx-im-content-notification-item__container {
    margin-bottom: 10px !important;
    border-radius: 8px !important;
  }
  .bx-im-content-notification-item-content__container {
    max-width: none !important;
    padding-bottom: 0 !important;
  }
`;

// Вырезает блоки цитат Bitrix (атрибуция "[Имя Фамилия] написал/а/и:" вместе с содержимым).
// Текст нужно передавать с \n вместо <br> (из innerHTML после замены)
function stripBitrixQuotes(text) {
  return text.replace(NOTIF_QUOTE_STRIP_RE, '');
}

// Две перестановки полного имени пользователя (Имя Фамилия / Фамилия Имя), без повторов
function nameVariants(firstName, lastName) {
  return [...new Set([`${firstName} ${lastName}`, `${lastName} ${firstName}`])];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Имя присутствует в тексте как отдельное слово. JS \b не работает с кириллицей,
// поэтому границу проверяем негативным lookaround по буквам/цифрам
function nameAsWord(text, name) {
  return new RegExp(`(?<![0-9A-Za-zА-Яа-яЁё])${escapeRegExp(name)}(?![0-9A-Za-zА-Яа-яЁё])`).test(text);
}

// Пользователь цитируется, если в сыром тексте есть атрибуция "[его имя] написал" (в любом порядке)
function isUserQuoted(text, firstName, lastName) {
  if (!text || !firstName || !lastName) return false;
  return nameVariants(firstName, lastName).some((name) => text.includes(`${name} написал`));
}

// Личное упоминание в канонизированном тексте: имя пользователя присутствует как отдельное слово.
// В отличие от tagall пустой токен TAGALL упоминанием не считается — здесь только имя
function textHasUserName(text, firstName, lastName) {
  if (!text || !firstName || !lastName) return false;
  return nameVariants(firstName, lastName).some((name) => nameAsWord(text, name));
}

// Жирные метки прямо в тексте уведомления (под галочкой): tagall-фраза → <b>TAGALL</b> (имя в фразе
// поглощается), затем личные упоминания → <b>имя</b>. Порядок важен: tagall до имён
function applyTextTransform(element, firstName, lastName) {
  const textElement = element.querySelector(SELECTORS.contentText);
  if (!textElement) return;

  let html = textElement.innerHTML.replace(TAGALL_NAMED_RE, `<b>${TAGALL_TOKEN}</b>`);
  if (firstName && lastName) {
    nameVariants(firstName, lastName).forEach((name) => {
      html = html.split(name).join(`<b>${name}</b>`);
    });
  }
  textElement.innerHTML = html;
}

export function notificationDetails(sessionId, options = {}) {
  const bitrixApi = new BitrixApi(sessionId);

  const flags = {
    dim: !!options.notificationDetailsDim,
    highlight: !!(options.notificationDetailsHighlight && options.userId),
    highlightCreator: !!(options.notificationDetailsHighlightCreator && options.userId),
    highlightMention: !!(options.notificationDetailsHighlightMention && options.userFirstName && options.userLastName),
    highlightTagall: !!options.notificationDetailsHighlightTagall,
    highlightTagallStatus: !!options.notificationDetailsHighlightTagallStatus,
    compact: !!options.notificationDetailsCompact,
    transformText: !!options.notificationDetailsTransformText,
  };

  const userId = options.userId ? String(options.userId) : null;

  // Единый источник подсветки: атрибут, иконка PrimeIcons, подпись, цвета рамки/фона и флаг.
  // Порядок = приоритет: getHighlightMatch берёт первый совпавший (он же задаёт иконку и чип),
  // а injectStyles вставляет CSS в обратном порядке, чтобы по каскаду победила рамка того же типа.
  // duplicatesType — ключ NOTIF_TYPES, чей тип-чип не дублируем (его заменяет чип подсветки).
  const HIGHLIGHT_ICONS = [
    {attribute: 'data-pts-my-mention', icon: 'pi-at', label: 'Упомянут', color: options.notificationDetailsHighlightMentionBorder, background: options.notificationDetailsHighlightMentionBackground, enabled: flags.highlightMention},
    {attribute: 'data-pts-my-task', icon: 'pi-wrench', label: 'Исполнитель', color: options.notificationDetailsHighlightBorder, background: options.notificationDetailsHighlightBackground, enabled: flags.highlight},
    {attribute: 'data-pts-my-creator-task', icon: 'pi-file-edit', label: 'Постановщик', color: options.notificationDetailsHighlightCreatorBorder, background: options.notificationDetailsHighlightCreatorBackground, enabled: flags.highlightCreator},
    {attribute: 'data-pts-tagall-status', icon: 'pi-check-circle', label: 'Статус', color: options.notificationDetailsHighlightTagallStatusBorder, background: options.notificationDetailsHighlightTagallStatusBackground, enabled: flags.highlightTagallStatus},
    {attribute: 'data-pts-tagall', icon: 'pi-megaphone', label: 'TAGALL', duplicatesType: 'tagall', color: options.notificationDetailsHighlightTagallBorder, background: options.notificationDetailsHighlightTagallBackground, enabled: flags.highlightTagall},
  ];

  // In-memory кэш на время жизни страницы
  const cache = {
    tasks: new Map(),       // taskId → task | null
    users: new Map(),       // userId → user | null
    groups: new Map(),      // groupId → group | null
    stages: new Map(),      // stageId → stage
    stageGroups: new Set(), // groupId, для которых стадии уже загружены
  };

  function injectStyles() {
    insertCSS(BASE_CSS);

    if (flags.compact) insertCSS(COMPACT_CSS);

    // Подсветка через data-атрибуты, а не классы: Bitrix Vue перезаписывает классы своих элементов
    const highlightCSS = (selector, border, background) => `
      ${selector} {
        border-color: ${border} !important;
        background-color: ${background} !important;
      }
    `;

    // В обратном порядке HIGHLIGHT_ICONS: при равной специфичности побеждает вставленное
    // последним, поэтому рамка типа с наивысшим приоритетом (первого в массиве) встанет последней
    [...HIGHLIGHT_ICONS].reverse().forEach((item) => {
      if (item.enabled) insertCSS(highlightCSS(`[${item.attribute}]`, item.color, item.background));
    });
  }

  // Находит ещё не обработанные уведомления о задачах, помечает их и навешивает скелетон
  function collectNewItems(container) {
    const candidates = [...container.querySelectorAll(SELECTORS.newItem)]
      .filter((el) => el.querySelector(SELECTORS.taskLink));

    const items = [];
    candidates.forEach((el) => {
      const href = el.querySelector(SELECTORS.taskLink).getAttribute('href');
      const taskId = getTaskIdFromUrl(href)?.taskId ?? null;

      if (!taskId) {
        el.setAttribute('data-pts-details', 'done');
        return;
      }

      el.setAttribute('data-pts-details', 'loading');
      const skeleton = document.createElement('div');
      skeleton.className = 'pts-nd-skeleton';
      el.querySelector(SELECTORS.titleContainer)?.appendChild(skeleton);
      items.push({el, skeleton, taskId});
    });

    return items;
  }

  // Двухфазная батч-загрузка: задачи, затем связанные группы, стадии и пользователи
  async function loadDetails(taskIds) {
    const uncachedTaskIds = taskIds.filter((id) => !cache.tasks.has(id));
    if (uncachedTaskIds.length) {
      const fetched = await bitrixApi.getTasksByIdsBatch(uncachedTaskIds);
      uncachedTaskIds.forEach((id) => cache.tasks.set(id, fetched[id] ?? null));
    }

    const tasks = taskIds.map((id) => cache.tasks.get(id)).filter(Boolean);

    const groupIds = [...new Set(tasks.map((task) => task.groupId).filter((id) => id && id !== '0'))];
    const userIds = [...new Set(
      tasks.flatMap((task) => [task.responsibleId, task.createdBy]).filter((id) => id && id !== '0'),
    )];

    const uncachedGroupIds = groupIds.filter((id) => !cache.groups.has(id));
    const uncachedStageGroupIds = groupIds.filter((id) => !cache.stageGroups.has(id));
    const uncachedUserIds = userIds.filter((id) => !cache.users.has(id));

    await Promise.all([
      uncachedGroupIds.length
        ? bitrixApi.getGroupsByIdsBatch(uncachedGroupIds).then((result) => {
          uncachedGroupIds.forEach((id) => cache.groups.set(id, result[id] ?? null));
        })
        : null,

      uncachedStageGroupIds.length
        ? bitrixApi.getStagesBatch(uncachedStageGroupIds).then((result) => {
          Object.entries(result).forEach(([stageId, stage]) => cache.stages.set(stageId, stage));
          uncachedStageGroupIds.forEach((id) => cache.stageGroups.add(id));
        })
        : null,

      uncachedUserIds.length
        ? bitrixApi.getImUsersBatch(uncachedUserIds).then((result) => {
          uncachedUserIds.forEach((id) => cache.users.set(id, result[id] ?? null));
        })
        : null,
    ]);
  }

  // innerHTML + замена <br> на \n нужны для корректного определения границ цитаты.
  // tagall-фраза канонизируется в TAGALL: токен упрощает детекцию, а имя из фразы
  // поглощается заменой и потому не принимается за личное упоминание
  function extractNotifText(el) {
    const textElement = el.querySelector(SELECTORS.contentText);
    const rawText = textElement
      ? textElement.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(TAGALL_NAMED_RE, TAGALL_TOKEN)
      : '';
    const hasQuote = NOTIF_QUOTE_RE.test(rawText);
    const notifText = hasQuote ? stripBitrixQuotes(rawText) : rawText;
    return {notifText, hasQuote, rawText};
  }

  function applyTextHighlights(el, notifText, rawText, isTagall, task) {
    if (flags.highlightTagallStatus && isTagall && TAGALL_STATUS_RE.test(notifText)) {
      el.setAttribute('data-pts-tagall-status', '');
    }
    if (flags.highlightTagall && isTagall) {
      el.setAttribute('data-pts-tagall', '');
    }

    if (!flags.highlightMention) return;

    // Имя из tagall-фразы уже поглощено токеном TAGALL, поэтому оставшееся в тексте имя —
    // настоящее упоминание. Цитирование тоже считаем упоминанием — по сырому тексту, т.к.
    // stripBitrixQuotes удалил бы атрибуцию цитаты из notifText
    const mentioned = textHasUserName(notifText, options.userFirstName, options.userLastName)
      || isUserQuoted(rawText, options.userFirstName, options.userLastName);
    if (!mentioned) return;

    // Новая задача, где пользователь не исполнитель: упоминание не считаем персональным
    const isNewTaskForOthers = NOTIF_NEW_TASK_RE.test(notifText)
      && (!userId || task.responsibleId !== userId);
    if (!isNewTaskForOthers) {
      el.setAttribute('data-pts-my-mention', '');
    }
  }

  function isHighlighted(el) {
    return el.hasAttribute('data-pts-my-task')
      || el.hasAttribute('data-pts-my-creator-task')
      || el.hasAttribute('data-pts-tagall')
      || el.hasAttribute('data-pts-tagall-status')
      || el.hasAttribute('data-pts-my-mention');
  }

  function createChip(title) {
    const chip = document.createElement('span');
    chip.className = 'pts-nd-chip';
    chip.title = title;
    return chip;
  }

  function createDot(color) {
    const dot = document.createElement('span');
    dot.className = 'pts-nd-stage-dot';
    dot.style.background = color;
    return dot;
  }

  function createLabel(text) {
    const label = document.createElement('span');
    label.textContent = text;
    return label;
  }

  function createTypeChip({label, color}) {
    const chip = createChip(`Тип: ${label}`);
    chip.append(createDot(color), createLabel(label));
    return chip;
  }

  // Чип-пояснение, почему карточка подсвечена: кружок цвета рамки + короткая подпись
  function createHighlightChip({label, color}) {
    const chip = createChip(`Подсветка: ${label}`);
    chip.append(createDot(color), createLabel(label));
    return chip;
  }

  function createTextChip(text, background, color, title) {
    const chip = createChip(title ?? text);
    chip.style.background = background;
    if (color) chip.style.color = color;
    chip.textContent = text;
    return chip;
  }

  function createGroupChip(group) {
    const chip = createChip(`Группа: ${group.NAME}`);
    chip.append(createDot(stringToPastelColor(group.NAME)), createLabel(group.NAME));
    return chip;
  }

  function createStageChip(stage) {
    const color = stage.COLOR
      ? (stage.COLOR.startsWith('#') ? stage.COLOR : `#${stage.COLOR}`)
      : DEFAULT_STAGE_COLOR;
    const chip = createChip(`Стадия: ${stage.TITLE}`);
    chip.append(createDot(color), createLabel(stage.TITLE));
    return chip;
  }

  function createUserChip(user, role) {
    const name = user.name || `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    const chip = createChip(`${role}: ${name}`);

    const hasAvatar = typeof user.avatar === 'string' && user.avatar.startsWith('http');
    if (hasAvatar) {
      const image = document.createElement('img');
      image.className = 'pts-nd-avatar';
      image.src = user.avatar;
      image.alt = name;
      chip.appendChild(image);
    } else {
      const initials = document.createElement('span');
      initials.className = 'pts-nd-initials';
      initials.style.background = stringToPastelColor(name || String(user.id));
      initials.textContent = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`;
      chip.appendChild(initials);
    }

    chip.appendChild(createLabel(name));
    return chip;
  }

  function renderChips(el, task, matchedTypes, highlight) {
    const chips = [];

    // Пояснение по подсветке — первым чипом
    if (highlight) chips.push(createHighlightChip(highlight));

    // У tagall комментарий избыточен — он подразумевается самим обращением
    const typesAfterTagall = matchedTypes.some(({key}) => key === 'tagall')
      ? matchedTypes.filter(({key}) => key !== 'comment')
      : matchedTypes;
    // Не дублируем тип-чипом тот тип, что уже показал чип подсветки (по ключу, не по подписи)
    const visibleTypes = highlight?.duplicatesType
      ? typesAfterTagall.filter(({key}) => key !== highlight.duplicatesType)
      : typesAfterTagall;
    visibleTypes.forEach((type) => chips.push(createTypeChip(type)));

    const group = cache.groups.get(task.groupId);
    if (group) {
      chips.push(createGroupChip(group));
    } else if (task.groupId && task.groupId !== '0') {
      chips.push(createTextChip(`#${task.groupId}`, '#f0f0f0', '#333', `Группа: #${task.groupId}`));
    }

    const stage = cache.stages.get(String(task.stageId));
    if (stage) chips.push(createStageChip(stage));

    const creator = cache.users.get(task.createdBy);
    if (creator) chips.push(createUserChip(creator, 'Постановщик'));

    const responsible = cache.users.get(task.responsibleId);
    if (responsible) chips.push(createUserChip(responsible, 'Исполнитель'));

    if (!chips.length) return;

    const block = document.createElement('div');
    block.className = 'pts-nd';
    chips.forEach((chip) => block.appendChild(chip));
    el.querySelector(SELECTORS.titleContainer)?.appendChild(block);
  }

  // Тип подсветки с видимой рамкой (первый совпавший по приоритету) — общий для иконки и чипа
  function getHighlightMatch(el) {
    return HIGHLIGHT_ICONS.find((item) => item.enabled && el.hasAttribute(item.attribute)) ?? null;
  }

  // Маркер-иконка в левом верхнем углу карточки
  function renderHighlightIcon(el, match) {
    if (!match) return;

    const icon = document.createElement('i');
    icon.className = `pi ${match.icon} pts-nd-icon`;
    icon.style.color = match.color;
    el.appendChild(icon);
  }

  function renderItem({el, skeleton, taskId}) {
    skeleton.remove();
    el.setAttribute('data-pts-details', 'done');

    const task = cache.tasks.get(taskId);
    if (!task) return;

    const {notifText, hasQuote, rawText} = extractNotifText(el);
    const isReaction = NOTIF_REACTION_RE.test(notifText);
    const isTagall = notifText.includes(TAGALL_TOKEN) && !isReaction;

    // Реакции не подсвечиваем вообще: ни ролью (исполнитель/постановщик), ни упоминанием, ни tagall
    if (!isReaction) {
      if (flags.highlight && task.responsibleId === userId) {
        el.setAttribute('data-pts-my-task', '');
      }
      if (flags.highlightCreator && task.createdBy === userId) {
        el.setAttribute('data-pts-my-creator-task', '');
      }

      applyTextHighlights(el, notifText, rawText, isTagall, task);
    }

    // tagall-тип берём из готового isTagall (канонический токен + исключение реакций), а не из
    // общего глобального TAGALL_WORD_RE — чтобы не мутировать его lastIndex (его делит tag-all-color)
    const matchedTypes = NOTIF_TYPES.filter(({key, re}) => (key === 'tagall' ? isTagall : re.test(notifText)));
    matchedTypes.forEach(({key}) => el.setAttribute(`data-pts-type-${key}`, ''));
    if (hasQuote) el.setAttribute('data-pts-type-quote', '');

    if (flags.dim && !isHighlighted(el)) {
      el.setAttribute('data-pts-dimmed', '');
    }

    const highlight = getHighlightMatch(el);
    renderHighlightIcon(el, highlight);
    renderChips(el, task, matchedTypes, highlight);

    if (flags.transformText) applyTextTransform(el, options.userFirstName, options.userLastName);
  }

  async function init() {
    const container = document.querySelector(SELECTORS.container);
    if (!container) return;

    const items = collectNewItems(container);
    if (!items.length) return;

    try {
      await loadDetails(items.map((item) => item.taskId));
      items.forEach(renderItem);
    } catch {
      items.forEach(({el, skeleton}) => {
        skeleton.remove();
        el.setAttribute('data-pts-details', 'error');
      });
    }
  }

  injectStyles();

  rehydrateOnChanges(
    init,
    document.body,
    {
      filterMutation: (mutation) => {
        if (!mutation.addedNodes.length) return false;

        const addedElements = [...mutation.addedNodes].filter((node) => node.nodeType === Node.ELEMENT_NODE);
        if (!addedElements.length) return false;

        // Игнорируем наши собственные вставки
        if (addedElements.every((node) => node.classList?.contains('pts-nd')
          || node.classList?.contains('pts-nd-skeleton')
          || node.classList?.contains('pts-nd-icon'))) {
          return false;
        }

        // При скролле уведомления добавляются внутрь уже существующего контейнера
        if (mutation.target.closest(SELECTORS.container)) return true;

        // При открытии панели добавляется крупный блок, содержащий уведомления
        return addedElements.some((node) => node.querySelector?.(SELECTORS.anyItem));
      },
    },
  );
}
