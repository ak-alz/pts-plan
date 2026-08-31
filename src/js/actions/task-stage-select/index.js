import {debounce} from 'lodash-es';

import BitrixApi from '../../BitrixApi.js';
import {insertCSS, waitForElement} from '../../utils.js';

const CREATE_FORM_URL_RE = /\/tasks\/task\/edit\/0(?:\/|\?|$)/;

const TITLE_BLOCK_SELECTOR = '.task-info-panel-title';
const PROJECT_ID_SELECTOR = 'input[name="ACTION[0][ARGUMENTS][data][SE_PROJECT][ID]"]';

// Собственного поля стадии в форме нет, но операция task.add внутреннего диспетчера принимает
// STAGE_ID среди остальных данных задачи — проверено экспериментом на всех похожих именах полей
// (SE_STAGE, KANBAN_STAGE_ID, параметр в адресе формы — не работает ни один)
const STAGE_FIELD_NAME = 'ACTION[0][ARGUMENTS][data][STAGE_ID]';

const STYLES = `
  .pts-task-stage {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
  }
  .pts-task-stage[hidden] {
    display: none;
  }
  .pts-task-stage-label {
    font-size: 13px;
    color: #6a737c;
  }
`;

export async function taskStageSelect(sessionId) {
  if (!CREATE_FORM_URL_RE.test(window.location.href)) return;

  const titleBlock = await waitForElement(TITLE_BLOCK_SELECTOR);
  const form = titleBlock?.closest('form');
  if (!form) return;

  const api = new BitrixApi(sessionId);

  insertCSS(STYLES, 'pts-task-stage-select');

  const wrapper = document.createElement('div');
  wrapper.className = 'pts-task-stage';
  wrapper.hidden = true;

  const label = document.createElement('label');
  label.className = 'pts-task-stage-label';
  label.htmlFor = 'pts-task-stage-select';
  label.textContent = 'Стадия';

  // Селект отправляется формой сам — отдельное скрытое поле не нужно. Пока стадии не загружены
  // или проект не выбран, он отключён: отключённое поле форма не отправляет, и задача уходит
  // в стадию по умолчанию
  const select = document.createElement('select');
  select.id = 'pts-task-stage-select';
  select.name = STAGE_FIELD_NAME;
  select.disabled = true;

  wrapper.append(label, select);
  titleBlock.after(wrapper);

  const projectIdInput = document.querySelector(PROJECT_ID_SELECTOR);
  let currentGroupId = null;
  let latestRequestId = 0;

  async function syncStages() {
    const projectId = projectIdInput?.value;
    // '0' — sentinel Bitrix для «без проекта». У личного плана свои стадии, и они не общие:
    // task.stages.get отдаёт план текущего пользователя, а задача может уйти другому
    const groupId = projectId && projectId !== '0' ? projectId : null;

    if (groupId === currentGroupId) return;
    currentGroupId = groupId;

    const requestId = ++latestRequestId;

    // Гасим селект до запроса: пока грузятся стадии нового проекта, в нём лежат стадии прошлого,
    // и форма, отправленная в этот момент, увезла бы задачу в стадию чужого проекта
    wrapper.hidden = true;
    select.disabled = true;
    select.replaceChildren();

    if (!groupId) return;

    let data;
    try {
      ({data} = await api.getStages(groupId));
    } catch (error) {
      // Проект не должен запомниться загруженным, иначе observer больше не попробует его перечитать.
      // Если пока ждали ответа проект успели сменить, чужой запрос перетирать нельзя
      if (requestId === latestRequestId) currentGroupId = null;
      throw error;
    }

    if (requestId !== latestRequestId) return;

    const stages = Object.values(data?.result ?? {}).sort((a, b) => a.SORT - b.SORT);

    select.replaceChildren(...stages.map((stage) => {
      const option = document.createElement('option');
      option.value = stage.ID;
      option.textContent = stage.TITLE;
      return option;
    }));

    wrapper.hidden = !stages.length;
    select.disabled = !stages.length;
  }

  // Значение скрытого поля проекта Bitrix проставляет из JS, атрибут при этом не меняется —
  // ловим перерисовку самой плашки выбранного проекта и перечитываем поле
  if (projectIdInput) {
    const observer = new MutationObserver(debounce(() => {
      syncStages().catch((error) => console.warn('[pts-plan] taskStageSelect', error));
    }, 200));
    observer.observe(projectIdInput.parentElement, {childList: true, subtree: true});
  }

  await syncStages();
}
