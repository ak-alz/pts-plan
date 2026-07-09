import BitrixApi from '../../BitrixApi.js';
import {
  NOTIF_NEW_TASK_RE,
  NOTIF_QUOTE_RE,
  NOTIF_QUOTE_STRIP_RE,
  NOTIF_REACTION_RE,
  TAGALL_NAMED_RE,
  TAGALL_STATUS_RE,
} from '../../patterns.js';
import {getTaskIdFromUrl, insertCSS, rehydrateOnChanges, stringToPastelColor, triggerScrollLoadMore} from '../../utils.js';
import {NOTIF_TYPES} from './notifTypes.js';

const SELECTORS = {
  container: '.bx-im-content-notification__elements',
  newItem: '.bx-im-content-notification-item__container[data-id]:not([data-pts-details])',
  anyItem: '.bx-im-content-notification-item__container',
  taskLink: 'a[href*="/tasks/task/view/"]',
  titleContainer: '.bx-im-content-notification-item-header__title-container',
  contentText: '.bx-im-content-notification-item-content__content-text',
  notifHeader: '.bx-im-content-notification__header',
  headerButtonsContainer: '.bx-im-content-notification__header-buttons-container',
};

// Канонический токен, на который заменяется tagall-фраза (для детекции и для жирной метки в тексте)
const TAGALL_TOKEN = 'TAGALL';
const DEFAULT_STAGE_COLOR = '#888888';

// Сколько подходящих под фильтр карточек стараемся догрузить, прежде чем остановиться
const FILTER_LOAD_MORE_TARGET = 10;
// Защита от бесконечной подгрузки, если у выбранной группы никогда не наберётся столько уведомлений
const FILTER_LOAD_MORE_MAX_ATTEMPTS = 30;

const FILTER_BAR_CSS = `
  .pts-nd-filter-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    flex: 1;
    min-width: 0;
    padding: 0 8px;
  }
  .pts-nd-filter-select {
    flex: 1 1 100px;
    min-width: 0;
    max-width: 150px;
    height: 26px;
    padding: 0 6px;
    border: 1px solid #d5dade;
    border-radius: 6px;
    background: #fff;
    font-size: 12px;
    color: #333;
    cursor: pointer;
  }
  .pts-nd-filter-select:hover {
    border-color: #adb4bc;
  }
  .pts-nd-filter-select:focus-visible {
    outline: 2px solid #a7c7e7;
    outline-offset: -1px;
  }
  .pts-nd-filter-reset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 1px solid #d5dade;
    border-radius: 6px;
    background: #fff;
    color: #828b95;
    font-size: 12px;
    cursor: pointer;
  }
  .pts-nd-filter-reset:hover {
    border-color: #adb4bc;
    color: #3a3d42;
  }
  .pts-nd-filter-reset[hidden] {
    display: none;
  }
`;

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
    filter: !!options.notificationDetailsFilter,
    dim: !!options.notificationDetailsDim,
    highlight: !!(options.notificationDetailsHighlight && options.userId),
    highlightCreator: !!(options.notificationDetailsHighlightCreator && options.userId),
    highlightMention: !!(options.notificationDetailsHighlightMention && options.userFirstName && options.userLastName),
    highlightTagall: !!options.notificationDetailsHighlightTagall,
    highlightTagallStatus: !!options.notificationDetailsHighlightTagallStatus,
    compact: !!options.notificationDetailsCompact,
    transformText: !!options.notificationDetailsTransformText,
    hideChips: !!options.notificationDetailsHideChips,
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

  const FILTER_STYLE_ID = 'pts-nd-active-filters';
  const FILTER_STATE_STORAGE_KEY = 'notification-details-filter';
  let selectedGroupId = '';
  let selectedHighlightAttribute = '';
  let filterLoadMoreAttempts = 0;
  let filterStateLoaded = false;

  function createOption(value, label) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }

  // Загружается один раз за время жизни страницы, до первой отрисовки фильтр-бара — благодаря
  // этому последний выбор пользователя (группа/тип) применяется сразу, как только для него
  // появится подходящая опция в списке (см. groupSelect.value/highlightSelect.value ниже)
  async function loadSavedFilterState() {
    if (filterStateLoaded) return;
    filterStateLoaded = true;

    const stored = await chrome.storage.local.get([FILTER_STATE_STORAGE_KEY]);
    const savedState = stored[FILTER_STATE_STORAGE_KEY];
    if (!savedState) return;

    selectedGroupId = savedState.groupId ?? '';
    selectedHighlightAttribute = savedState.highlightAttribute ?? '';
  }

  function saveFilterState() {
    chrome.storage.local.set({
      [FILTER_STATE_STORAGE_KEY]: {
        groupId: selectedGroupId,
        highlightAttribute: selectedHighlightAttribute,
      },
    });
  }

  function injectFilterUI() {
    if (!flags.filter) return;

    const header = document.querySelector(SELECTORS.notifHeader);
    if (!header || header.querySelector('.pts-nd-filter-bar')) return;

    const buttonsContainer = header.querySelector(SELECTORS.headerButtonsContainer);
    if (!buttonsContainer) return;

    const filterBar = document.createElement('div');
    filterBar.className = 'pts-nd-filter-bar';

    const groupSelect = document.createElement('select');
    groupSelect.className = 'pts-nd-filter-select pts-nd-group-select';
    groupSelect.appendChild(createOption('', 'Все группы'));
    groupSelect.addEventListener('change', (event) => {
      selectedGroupId = event.target.value;
      filterLoadMoreAttempts = 0;
      applyFilters();
      saveFilterState();
      maybeTriggerFilterLoadMore(document.querySelector(SELECTORS.container));
    });
    filterBar.appendChild(groupSelect);

    let highlightSelect = null;

    // Селект типов имеет смысл, только если хотя бы одна подсветка включена в настройках —
    // иначе он всегда останется пустым (data-атрибуты подсветки не расставляются вовсе, см. renderItem)
    if (HIGHLIGHT_ICONS.some((item) => item.enabled)) {
      highlightSelect = document.createElement('select');
      highlightSelect.className = 'pts-nd-filter-select pts-nd-highlight-select';
      highlightSelect.appendChild(createOption('', 'Все типы'));
      highlightSelect.addEventListener('change', (event) => {
        selectedHighlightAttribute = event.target.value;
        filterLoadMoreAttempts = 0;
        applyFilters();
        saveFilterState();
        maybeTriggerFilterLoadMore(document.querySelector(SELECTORS.container));
      });
      filterBar.appendChild(highlightSelect);
    } else if (selectedHighlightAttribute) {
      // Ни одна подсветка не включена — сам селект типов не создаётся, значит восстановленный
      // выбор типа применить/показать нечем. Сбрасываем, иначе он "невидимо" отфильтрует всё
      // подряд без возможности вернуть его обратно через UI
      selectedHighlightAttribute = '';
      saveFilterState();
    }

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'pts-nd-filter-reset';
    resetButton.title = 'Сбросить фильтры';
    resetButton.innerHTML = '<i class="pi pi-filter-slash"></i>';
    resetButton.addEventListener('click', () => {
      selectedGroupId = '';
      selectedHighlightAttribute = '';
      filterLoadMoreAttempts = 0;
      groupSelect.value = '';
      if (highlightSelect) highlightSelect.value = '';
      applyFilters();
      saveFilterState();
    });
    filterBar.appendChild(resetButton);

    header.insertBefore(filterBar, buttonsContainer);

    // selectedGroupId/selectedHighlightAttribute не сбрасываем — к этому моменту в них уже может
    // лежать восстановленный chrome.storage.local выбор (см. loadSavedFilterState в init()).
    // Вызывается только после insertBefore — applyFilters() ищет resetButton через
    // document.querySelector, а до вставки filterBar в документ он там не найдётся
    applyFilters();
  }

  // Каждое условие — своя CSS-инструкция display:none, а не одна объединённая: карточка видна,
  // только если не спряталась ни по одному из активных фильтров (эффективно работает как AND).
  // Единая точка входа для любого изменения selectedGroupId/selectedHighlightAttribute — заодно
  // держит видимость кнопки сброса в актуальном состоянии, без отдельных вызовов по всем местам
  function applyFilters() {
    const rules = [];
    if (selectedGroupId) {
      rules.push(`.bx-im-content-notification-item__container:not([data-pts-group="${selectedGroupId}"]) { display: none !important; }`);
    }
    if (selectedHighlightAttribute) {
      rules.push(`.bx-im-content-notification-item__container:not([${selectedHighlightAttribute}]) { display: none !important; }`);
    }

    const resetButton = document.querySelector('.pts-nd-filter-reset');
    if (resetButton) resetButton.hidden = !rules.length;

    if (!rules.length) {
      document.getElementById(FILTER_STYLE_ID)?.remove();
      return;
    }

    let styleElement = document.getElementById(FILTER_STYLE_ID);
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = FILTER_STYLE_ID;
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = rules.join('\n');
  }

  // selectedGroupId/selectedHighlightAttribute — источник истины для того, что реально выбрано
  // (могли быть восстановлены из chrome.storage.local ещё до того, как список вообще успел
  // построиться в первый раз), поэтому синхронизация всегда идёт от них к <select>, а не наоборот.
  // Счётчик — по реально отрендеренным карточкам в DOM (data-pts-group), а не по числу уникальных
  // задач в cache.tasks: одна задача может дать несколько уведомлений (комментарий, реакция и
  // т.д.), и при подсчёте по задачам счётчик группы переставал расти после дозагрузки новых
  // уведомлений по уже виденным задачам — притом что реальный список продолжал пополняться
  function updateGroupFilterOptions(container) {
    const groupSelect = document.querySelector('.pts-nd-group-select');
    if (!groupSelect) return;

    const groupCounts = new Map();
    container.querySelectorAll('[data-pts-details="done"][data-pts-group]').forEach((element) => {
      const groupId = element.getAttribute('data-pts-group');
      if (!groupId || groupId === '0') return;
      groupCounts.set(groupId, (groupCounts.get(groupId) ?? 0) + 1);
    });

    // Текущий выбор остаётся в списке, даже если для него пока (или уже) нет ни одной карточки —
    // иначе <select> не сможет отразить фактически активный фильтр и застрянет на "Все группы"
    // визуально, при том что список по факту пуст, а вернуть выбор в "Все группы" будет нечем:
    // повторный выбор уже видимого пункта не генерирует событие change
    if (selectedGroupId && !groupCounts.has(selectedGroupId)) {
      groupCounts.set(selectedGroupId, 0);
    }

    groupSelect.innerHTML = '';
    groupSelect.appendChild(createOption('', 'Все группы'));

    [...groupCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([groupId, count]) => {
        const group = cache.groups.get(groupId);
        const groupName = group?.NAME ?? `Группа #${groupId}`;
        groupSelect.appendChild(createOption(groupId, `${groupName} (${count})`));
      });

    if (selectedGroupId) groupSelect.value = selectedGroupId;
  }

  // Типы, как и группы выше, считаются прямо по DOM — не накапливаются в отдельном кэше, а
  // проставляются как data-атрибуты уже на отрендеренных карточках
  function updateHighlightFilterOptions(container) {
    const highlightSelect = document.querySelector('.pts-nd-highlight-select');
    if (!highlightSelect) return;

    highlightSelect.innerHTML = '';
    highlightSelect.appendChild(createOption('', 'Все типы'));

    HIGHLIGHT_ICONS.forEach((item) => {
      const isSelected = item.attribute === selectedHighlightAttribute;
      // Показываем только включённые в настройках подсветки — кроме уже выбранной (см. комментарий
      // про selectedGroupId выше — та же причина: иначе выбор станет невозвратным через сам select)
      if (!item.enabled && !isSelected) return;

      const count = container.querySelectorAll(`[${item.attribute}]`).length;
      if (!count && !isSelected) return;

      highlightSelect.appendChild(createOption(item.attribute, `${item.label} (${count})`));
    });

    if (selectedHighlightAttribute) highlightSelect.value = selectedHighlightAttribute;
  }

  function countMatchingVisibleItems(container) {
    const requiredAttributes = [
      selectedGroupId && `[data-pts-group="${selectedGroupId}"]`,
      selectedHighlightAttribute && `[${selectedHighlightAttribute}]`,
    ].filter(Boolean).join('');

    return container.querySelectorAll(`[data-pts-details="done"]${requiredAttributes}`).length;
  }

  // Пока по активным фильтрам видно меньше FILTER_LOAD_MORE_TARGET карточек — просим Bitrix
  // догрузить ещё уведомлений (см. triggerScrollLoadMore в utils.js). Уже загруженные новые
  // карточки проходят через обычный rehydrateOnChanges → init(), который вызовет эту функцию
  // снова — отдельный цикл ожидания не нужен, он сам продолжится по мутациям DOM либо
  // остановится, когда Bitrix перестанет присылать новые уведомления (реальный конец истории)
  function maybeTriggerFilterLoadMore(container) {
    if (!container || (!selectedGroupId && !selectedHighlightAttribute)) return;
    if (filterLoadMoreAttempts >= FILTER_LOAD_MORE_MAX_ATTEMPTS) return;
    if (countMatchingVisibleItems(container) >= FILTER_LOAD_MORE_TARGET) return;

    filterLoadMoreAttempts += 1;
    triggerScrollLoadMore(container);
  }

  function injectStyles() {
    if (flags.filter) insertCSS(FILTER_BAR_CSS);
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

    // Группы/стадии/пользователи нужны только для чипов (плюс группы — ещё и для подписей
    // в фильтре). Если чипы скрыты, эти batch-запросы пропускаем — они больше ни на что не влияют
    const needsGroups = !flags.hideChips || flags.filter;
    const needsStagesAndUsers = !flags.hideChips;

    const groupIds = needsGroups
      ? [...new Set(tasks.map((task) => task.groupId).filter((id) => id && id !== '0'))]
      : [];
    const userIds = needsStagesAndUsers
      ? [...new Set(
        tasks.flatMap((task) => [task.responsibleId, task.createdBy]).filter((id) => id && id !== '0'),
      )]
      : [];

    const uncachedGroupIds = groupIds.filter((id) => !cache.groups.has(id));
    const uncachedStageGroupIds = needsStagesAndUsers
      ? groupIds.filter((id) => !cache.stageGroups.has(id))
      : [];
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

    el.setAttribute('data-pts-group', task.groupId || '0');

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
    if (!flags.hideChips) renderChips(el, task, matchedTypes, highlight);

    if (flags.transformText) applyTextTransform(el, options.userFirstName, options.userLastName);
  }

  async function init() {
    const container = document.querySelector(SELECTORS.container);
    if (!container) return;

    if (flags.filter) await loadSavedFilterState();

    injectFilterUI();

    const items = collectNewItems(container);
    if (items.length) {
      try {
        await loadDetails(items.map((item) => item.taskId));
        items.forEach(renderItem);
        updateGroupFilterOptions(container);
        updateHighlightFilterOptions(container);
      } catch {
        items.forEach(({el, skeleton}) => {
          skeleton.remove();
          el.setAttribute('data-pts-details', 'error');
        });
      }
    }

    // Проверяем даже когда новых карточек не было — например, сразу после выбора фильтра
    // или когда предыдущая попытка подгрузки ничего не добавила (см. maybeTriggerFilterLoadMore)
    maybeTriggerFilterLoadMore(container);
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
