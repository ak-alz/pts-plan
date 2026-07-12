import BitrixApi from '../../BitrixApi.js';
import { getTaskIdFromUrl, waitForElement } from '../../utils.js';

const TITLE_FIELD_SELECTOR = 'input[name="ACTION[0][ARGUMENTS][data][TITLE]"]';
const HIDDEN_PARENT_ID_SELECTOR = 'input[name="HIT_STATE[INITIAL_TASK_DATA][PARENT_ID]"]';
const HIDDEN_DESCRIPTION_SELECTOR = 'input[name="HIT_STATE[INITIAL_TASK_DATA][DESCRIPTION]"]';

function getSourceTaskId() {
  const hiddenParentIdField = document.querySelector(HIDDEN_PARENT_ID_SELECTOR);
  // '0' — sentinel Bitrix для «нет родителя» (та же конвенция, что и у GROUP_ID), а не реальный ID
  if (hiddenParentIdField?.value && hiddenParentIdField.value !== '0') return hiddenParentIdField.value;

  // «Создать задачу» (не подзадачу) из комментария — PARENT_ID в форме нет, но Bitrix сам
  // подставляет в DESCRIPTION ссылку вида .../tasks/task/view/{taskId}/?commentId=... на задачу-источник.
  const hiddenDescriptionField = document.querySelector(HIDDEN_DESCRIPTION_SELECTOR);
  const descriptionTaskId = hiddenDescriptionField?.value ? getTaskIdFromUrl(hiddenDescriptionField.value)?.taskId : null;
  if (descriptionTaskId) return descriptionTaskId;

  // При создании подзадачи через «Добавить подзадачу» на самой задаче PARENT_ID есть в URL,
  // но при создании из комментария к задаче его там нет — только в скрытых полях выше.
  return new URL(window.location.href).searchParams.get('PARENT_ID');
}

export async function autoTaskTitle(sessionId) {
  if (!/\/tasks\/task\/edit\/0(?:\/|\?|$)/.test(window.location.href)) return;

  const titleField = await waitForElement(TITLE_FIELD_SELECTOR);
  if (!titleField) return;

  // Bitrix сам подставляет в это поле текст комментария при создании задачи/подзадачи из
  // комментария — запоминаем это значение, чтобы ниже отличить его от ручного ввода пользователя.
  const initialTitleValue = titleField.value;

  const sourceTaskId = getSourceTaskId();
  if (!sourceTaskId) return;

  const api = new BitrixApi(sessionId);
  const {data} = await api.getTask(sourceTaskId, ['TITLE']);
  const sourceTaskTitle = data?.result?.task?.title;
  if (!sourceTaskTitle) return;
  if (titleField.value !== initialTitleValue) return;

  // Поле — часть Bitrix-компонента, отслеживающего только события input/change,
  // поэтому просто titleField.value = ... не подхватится его собственной логикой.
  const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeValueSetter.call(titleField, sourceTaskTitle);
  titleField.dispatchEvent(new Event('input', {bubbles: true}));
  titleField.dispatchEvent(new Event('change', {bubbles: true}));
}
