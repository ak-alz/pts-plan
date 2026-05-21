import BitrixApi from '../../BitrixApi.js';
import {getTaskIdFromUrl, insertCSS, isUserMentioned, rehydrateOnChanges, stringToPastelColor} from '../../utils.js';

export function notificationDetails(sessionId, options = {}) {
  const bitrixApi = new BitrixApi(sessionId);

  const shouldHighlight = !!(options.notificationDetailsHighlight && options.userId);
  const shouldHighlightCreator = !!(options.notificationDetailsHighlightCreator && options.userId);
  const shouldHighlightMention = !!(options.notificationDetailsHighlightMention && options.userFirstName && options.userLastName);
  const shouldHighlightTagall = !!options.notificationDetailsHighlightTagall;
  const shouldCompact = !!options.notificationDetailsCompact;

  // In-memory кэш на время сессии страницы
  const cache = {
    tasks: new Map(),       // taskId → task | null
    users: new Map(),       // userId → user | null
    groups: new Map(),      // groupId → group | null
    stages: new Map(),      // stageId → stage
    stageGroups: new Set(), // groupId, для которых стадии уже загружены
  };

  insertCSS(`
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
  `);

  if (shouldCompact) {
    insertCSS(`
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
    `);
  }

  if (shouldHighlight) {
    insertCSS(`
      .pts-nd-my-task {
        border-color: ${options.notificationDetailsHighlightBorder} !important;
        background-color: ${options.notificationDetailsHighlightBackground} !important;
      }
    `);
  }

  if (shouldHighlightCreator) {
    insertCSS(`
      .pts-nd-my-creator-task {
        border-color: ${options.notificationDetailsHighlightCreatorBorder} !important;
        background-color: ${options.notificationDetailsHighlightCreatorBackground} !important;
      }
    `);
  }

  if (shouldHighlightMention) {
    insertCSS(`
      .pts-nd-my-mention {
        border-color: ${options.notificationDetailsHighlightMentionBorder} !important;
        background-color: ${options.notificationDetailsHighlightMentionBackground} !important;
      }
    `);
  }

  if (shouldHighlightTagall) {
    insertCSS(`
      .pts-nd-tagall {
        border-color: ${options.notificationDetailsHighlightTagallBorder} !important;
        background-color: ${options.notificationDetailsHighlightTagallBackground} !important;
      }
    `);
  }

  async function init() {
    const container = document.querySelector('.bx-im-content-notification__elements');
    if (!container) return;

    const newItems = [...container.querySelectorAll(
      '.bx-im-content-notification-item__container[data-id]:not([data-pts-details])',
    )].filter((el) => el.querySelector('a[href*="/tasks/task/view/"]'));

    if (!newItems.length) return;

    const items = [];
    newItems.forEach((el) => {
      const href = el.querySelector('a[href*="/tasks/task/view/"]').getAttribute('href');
      const taskId = getTaskIdFromUrl(href)?.taskId ?? null;

      if (!taskId) {
        el.setAttribute('data-pts-details', 'done');
        return;
      }

      el.setAttribute('data-pts-details', 'loading');
      const skeleton = document.createElement('div');
      skeleton.className = 'pts-nd-skeleton';
      el.querySelector('.bx-im-content-notification-item-header__title-container')?.appendChild(skeleton);
      items.push({el, skeleton, taskId});
    });

    if (!items.length) return;

    try {
      // --- Задачи ---
      const taskIds = items.map((d) => d.taskId);
      const uncachedTaskIds = taskIds.filter((id) => !cache.tasks.has(id));

      if (uncachedTaskIds.length) {
        const fetched = await bitrixApi.getTasksByIdsBatch(uncachedTaskIds);
        uncachedTaskIds.forEach((id) => cache.tasks.set(id, fetched[id] ?? null));
      }

      // --- Группы, стадии, пользователи ---
      const allTasks = taskIds.map((id) => cache.tasks.get(id)).filter(Boolean);

      const groupIds = [...new Set(allTasks.map((t) => t.groupId).filter((id) => id && id !== '0'))];
      const userIds = [...new Set(
        allTasks.flatMap((t) => [t.responsibleId, t.createdBy]).filter((id) => id && id !== '0'),
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

      // --- Отрисовка из кэша ---
      items.forEach(({el, skeleton, taskId}) => {
        skeleton.remove();
        el.setAttribute('data-pts-details', 'done');

        const task = cache.tasks.get(taskId);
        if (!task) return;

        if (shouldHighlight && task.responsibleId === String(options.userId)) {
          el.classList.add('pts-nd-my-task');
        }
        if (shouldHighlightCreator && task.createdBy === String(options.userId)) {
          el.classList.add('pts-nd-my-creator-task');
        }
        const notifText = el.querySelector('.bx-im-content-notification-item-content__content-text')?.textContent ?? '';

        if (shouldHighlightTagall && notifText.includes('и другие участники задачи')) {
          el.classList.add('pts-nd-tagall');
        }

        if (shouldHighlightMention && !el.classList.contains('pts-nd-tagall')) {
          const isNewTask = /^(Добавила? новую задачу|Добавлена новая задача) \[#/.test(notifText);
          const isNotResponsible = !options.userId || task.responsibleId !== String(options.userId);
          if (isUserMentioned(notifText, options.userFirstName, options.userLastName) && !(isNewTask && isNotResponsible)) {
            el.classList.add('pts-nd-my-mention');
          }
        }

        const chips = [];

        const group = cache.groups.get(task.groupId);
        if (group) {
          chips.push(createGroupChip(group));
        } else if (task.groupId && task.groupId !== '0') {
          chips.push(createTextChip(`#${task.groupId}`, '#f0f0f0', '#333', `Группа: #${task.groupId}`));
        }

        const stage = cache.stages.get(String(task.stageId));
        if (stage) chips.push(createStageChip(stage));

        const responsible = cache.users.get(task.responsibleId);
        if (responsible) chips.push(createUserChip(responsible, 'Исполнитель'));

        const creator = cache.users.get(task.createdBy);
        if (creator) chips.push(createUserChip(creator, 'Постановщик'));

        if (!chips.length) return;

        const block = document.createElement('div');
        block.className = 'pts-nd';
        chips.forEach((chip) => block.appendChild(chip));
        el.querySelector('.bx-im-content-notification-item-header__title-container')?.appendChild(block);
      });
    } catch {
      items.forEach(({el, skeleton}) => {
        skeleton.remove();
        el.setAttribute('data-pts-details', 'error');
      });
    }
  }

  function createTextChip(text, bg, color, title) {
    const chip = document.createElement('span');
    chip.className = 'pts-nd-chip';
    chip.style.background = bg;
    if (color) chip.style.color = color;
    chip.title = title ?? text;
    chip.textContent = text;
    return chip;
  }

  function createGroupChip(group) {
    const chip = document.createElement('span');
    chip.className = 'pts-nd-chip';
    chip.title = `Группа: ${group.NAME}`;

    const dot = document.createElement('span');
    dot.className = 'pts-nd-stage-dot';
    dot.style.background = stringToPastelColor(group.NAME);

    const label = document.createElement('span');
    label.textContent = group.NAME;

    chip.appendChild(dot);
    chip.appendChild(label);
    return chip;
  }

  function createStageChip(stage) {
    const color = stage.COLOR
      ? (stage.COLOR.startsWith('#') ? stage.COLOR : `#${stage.COLOR}`)
      : '#888888';
    const chip = document.createElement('span');
    chip.className = 'pts-nd-chip';
    chip.title = `Стадия: ${stage.TITLE}`;

    const dot = document.createElement('span');
    dot.className = 'pts-nd-stage-dot';
    dot.style.background = color;

    const label = document.createElement('span');
    label.textContent = stage.TITLE;

    chip.appendChild(dot);
    chip.appendChild(label);
    return chip;
  }

  function createUserChip(user, role) {
    const chip = document.createElement('span');
    chip.className = 'pts-nd-chip';
    const name = user.name || `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    chip.title = `${role}: ${name}`;

    if (user.avatar && typeof user.avatar === 'string' && user.avatar.startsWith('http')) {
      const img = document.createElement('img');
      img.className = 'pts-nd-avatar';
      img.src = user.avatar;
      img.alt = name;
      chip.appendChild(img);
    } else {
      const initials = document.createElement('span');
      initials.className = 'pts-nd-initials';
      initials.style.background = stringToPastelColor(name || String(user.id));
      initials.textContent = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`;
      chip.appendChild(initials);
    }

    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    chip.appendChild(nameSpan);

    return chip;
  }

  rehydrateOnChanges(
    init,
    document.body,
    {
      filterMutation: (mutation) => {
        if (!mutation.addedNodes.length) return false;

        const addedElements = [...mutation.addedNodes].filter((n) => n.nodeType === Node.ELEMENT_NODE);
        if (!addedElements.length) return false;

        // Игнорируем наши собственные вставки
        if (addedElements.every((n) => n.classList?.contains('pts-nd') || n.classList?.contains('pts-nd-skeleton'))) {
          return false;
        }

        // При скролле: уведомления добавляются внутрь уже существующего контейнера
        if (mutation.target.closest('.bx-im-content-notification__elements')) return true;

        // При открытии панели: добавляется крупный блок, содержащий уведомления
        return addedElements.some((n) => n.querySelector?.('.bx-im-content-notification-item__container'));
      },
    },
  );
}
