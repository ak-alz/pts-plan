import {insertCSS, pluralize} from '../../utils.js';

// Страница полного списка уведомлений. Домен не проверяем — на порталах без /alert/ якорей
// всё равно не будет, и каждая подфича молча выйдет
const ALERT_PATH_RE = /^\/alert\/?$/;

// Название группы Bitrix дописывает в текст ссылки на задачу: «Название задачи (в группе Разработка)»
const GROUP_NAME_RE = /\(в группе (.+)\)/i;
const TASK_VIEW_URL_RE = /\/tasks\/task\/view\/(\d+)/;
const TASK_LINK_SELECTOR = '.message-message a[href*="/tasks/task/view/"]';

// Больше вкладок за раз браузер начинает блокировать, да и открыть их случайно легко
const OPEN_ALL_TASKS_CONFIRM_THRESHOLD = 10;

const ALL_GROUPS_VALUE = 'all';
const NO_GROUP_VALUE = 'none';

/**
 * Группа задачи по блоку сообщений: имя из текста ссылки, адрес — та же ссылка без части задачи.
 * @param {Element} element блок задачи или отдельное сообщение
 * @return {{name: string, url: string}|null} null, если сообщение не про задачу в группе
 */
function getTaskGroup(element) {
  const link = element.querySelector(TASK_LINK_SELECTOR);
  if (!link) return null;

  const name = GROUP_NAME_RE.exec(link.textContent)?.[1]?.trim();
  if (!name) return null;

  return {name, url: link.href.replace(/task\/view\/.+/i, '')};
}

/**
 * Элементы, которые фильтр показывает и скрывает: блоки задач и одиночные сообщения вне блоков.
 * @return {Element[]}
 */
function getFilterItems() {
  const taskBlocks = [...document.querySelectorAll('div.task-messages-wrapper')];
  const singleMessages = [...document.querySelectorAll('div.message-item')]
    .filter((message) => !message.closest('div.task-messages-wrapper'));

  return [...taskBlocks, ...singleMessages];
}

function openAllTasks() {
  const urlsByTaskId = new Map();

  document.querySelectorAll(TASK_LINK_SELECTOR).forEach((link) => {
    const taskId = TASK_VIEW_URL_RE.exec(link.href)?.[1];
    if (!taskId || urlsByTaskId.has(taskId)) return;
    urlsByTaskId.set(taskId, link.href);
  });

  const urls = [...urlsByTaskId.values()];
  if (!urls.length) return;

  const tabsWord = pluralize(urls.length, ['вкладка', 'вкладки', 'вкладок']);
  if (urls.length > OPEN_ALL_TASKS_CONFIRM_THRESHOLD
    && !window.confirm(`Будет открыто ${urls.length} ${tabsWord}. Продолжить?`)) return;

  urls.forEach((url) => window.open(url, '_blank'));
}

// Не вешаем кнопку на a.delete-button ("Применить и удалить") — та скрыта через
// display:none и появляется по неизвестной нам логике показа, соседство с ней рискованно
function addOpenAllTasksButton() {
  const totalElement = document.querySelector('span.alert-total');
  if (!totalElement) return;

  insertCSS(`
    .pts-alert-open-all {
      color: #e4ae16;
      font-size: 12px;
      text-decoration: underline;
      cursor: pointer;
    }
    .pts-alert-open-all:hover {
      color: #c6960a;
    }
  `, 'pts-alert-open-all');

  const button = Object.assign(document.createElement('span'), {
    className: 'pts-alert-open-all',
    textContent: 'Открыть все задачи',
  });

  button.addEventListener('click', openAllTasks);
  totalElement.after(' | ', button);
}

function addGroupNames() {
  document.querySelectorAll('div.task-messages-wrapper').forEach((taskBlock) => {
    const title = taskBlock.querySelector('div.task-title');
    if (!title || title.querySelector('.pts-alert-group-link')) return;

    const group = getTaskGroup(taskBlock);
    if (!group) return;

    const link = Object.assign(document.createElement('a'), {
      className: 'pts-alert-group-link',
      href: group.url,
      textContent: group.name,
    });

    title.append(' | Группа ', link);
  });
}

/**
 * Заполняет список групп в селекте.
 * @param {HTMLSelectElement} select
 * @param {Map<string, number>} countsByGroup имя группы (или NO_GROUP_VALUE) → количество блоков
 */
function renderFilterOptions(select, countsByGroup) {
  const items = [{value: ALL_GROUPS_VALUE, label: 'Все группы'}];

  if (countsByGroup.has(NO_GROUP_VALUE)) {
    items.push({value: NO_GROUP_VALUE, label: `Без группы (${countsByGroup.get(NO_GROUP_VALUE)})`});
  }

  [...countsByGroup.keys()]
    .filter((name) => name !== NO_GROUP_VALUE)
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .forEach((name) => items.push({value: name, label: `${name} (${countsByGroup.get(name)})`}));

  select.replaceChildren(...items.map(({value, label}) => Object.assign(document.createElement('option'), {
    value,
    textContent: label,
  })));
}

function applyGroupFilter(value) {
  getFilterItems().forEach((item) => {
    const isHidden = value !== ALL_GROUPS_VALUE && item.dataset.ptsAlertGroup !== value;
    item.classList.toggle('pts-alert-filtered-out', isHidden);
  });
}

// Любая фильтрация на этой странице (в т.ч. пагинация) реализована на бекенде и полностью
// перезагружает документ — скрипт запускается заново с нуля, отслеживать динамическую
// подгрузку карточек без reload не нужно
function addGroupFilter() {
  const settingsRows = document.querySelectorAll('div.settings-row');
  const settingsRow = settingsRows[settingsRows.length - 1];
  const items = getFilterItems();
  if (!settingsRow || !items.length) return;

  insertCSS(`
    .pts-alert-group-filter {
      box-sizing: border-box;
      height: 30px;
      width: 200px;
      margin-left: 25px;
      font-size: 12px;
      border: 1px solid #dbdbdb;
    }
    .pts-alert-filtered-out {
      display: none !important;
    }
  `, 'pts-alert-group-filter');

  const select = Object.assign(document.createElement('select'), {className: 'pts-alert-group-filter'});
  const countsByGroup = new Map();

  items.forEach((item) => {
    const groupName = getTaskGroup(item)?.name ?? NO_GROUP_VALUE;
    item.dataset.ptsAlertGroup = groupName;
    countsByGroup.set(groupName, (countsByGroup.get(groupName) ?? 0) + 1);
  });

  renderFilterOptions(select, countsByGroup);
  select.addEventListener('change', () => applyGroupFilter(select.value));
  settingsRow.append(select);
}

// Bitrix показывает вверху страницы не то число, что реально в списке
function fixTotalCount() {
  const messages = document.querySelector('div.im-messages');
  const total = document.querySelector('span.alert-total b');
  if (!messages || !total) return;

  total.textContent = messages.children.length;
}

export function alertPage(options = {}) {
  if (!ALERT_PATH_RE.test(window.location.pathname)) return;

  if (options.alertPageOpenAllTasks) addOpenAllTasksButton();
  if (options.alertPageGroupName) addGroupNames();
  if (options.alertPageGroupFilter) addGroupFilter();

  fixTotalCount();
}
