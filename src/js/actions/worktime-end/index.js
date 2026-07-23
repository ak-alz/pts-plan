import dayjs from 'dayjs';

import {showToast} from '../../toastHost/showToast.js';
import {rehydrateOnChanges} from '../../utils.js';

const POPUP_SELECTOR = '.intranet-avatar-widget-base-popup';
const TASK_STATUS_SELECTOR = '.intranet-avatar-widget-item__task-status';
const MAIN_TIMER_SELECTOR = '.tm-control-panel__timer.tm-timer:not(.tm-control-panel__timer_pause)';
const RESULT_SELECTOR = '.pts-worktime-end';

function getClockSeconds(timerElement) {
  const hours = parseInt(timerElement.querySelector('.bui-clock__value_hours')?.textContent, 10) || 0;
  const minutes = parseInt(timerElement.querySelector('.bui-clock__value_minutes')?.textContent, 10) || 0;
  const seconds = parseInt(timerElement.querySelector('.bui-clock__value_seconds')?.textContent, 10) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function formatEndTime(moment) {
  return moment.format('HH:mm');
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

function applyContent(root, endText, overtimeText) {
  const bold = root.querySelector('b');
  if (bold.textContent !== endText) bold.textContent = endText;

  const overtime = root.querySelector('.pts-worktime-overtime');
  if (overtime.textContent !== overtimeText) overtime.textContent = overtimeText;
  overtime.classList.toggle('hidden', !overtimeText);
}

/**
 * Показывает расчётное время окончания рабочего дня рядом с таймером «Начать/Закончить работу»
 * в попапе профиля Bitrix: текущее время + оставшееся до конца рабочего дня (длительность дня минус
 * уже отработанное). При переработке показывает момент выработки нормы и величину переработки.
 * Считается один раз при каждом структурном изменении попапа (открытие,
 * пауза/продолжение/завершение) — не тикает вместе с таймером каждую секунду.
 * @param {number} dayHours - Длительность рабочего дня в часах.
 */
export function worktimeEnd(dayHours = 8) {
  const dayDurationSeconds = dayHours * 3600;

  function render() {
    const taskStatus = document.querySelector(`${POPUP_SELECTOR} ${TASK_STATUS_SELECTOR}`);
    if (!taskStatus) return;

    const existing = taskStatus.querySelector(RESULT_SELECTOR);
    const mainTimer = taskStatus.querySelector(MAIN_TIMER_SELECTOR);
    const titleElement = mainTimer?.querySelector('.tm-timer__title');
    if (!mainTimer || titleElement?.textContent.trim() === 'Не работаю') {
      existing?.remove();
      return;
    }

    const workedSeconds = getClockSeconds(mainTimer);
    // Без Math.max: при переработке остаток отрицательный, поэтому время окончания уходит в прошлое —
    // это момент, когда норма дня была выработана. Модуль отрицательного остатка — величина переработки.
    const remainingWorkSeconds = dayDurationSeconds - workedSeconds;
    const endText = formatEndTime(dayjs().add(remainingWorkSeconds, 'second'));
    const overtimeText = remainingWorkSeconds < 0 ? `переработка ${formatDuration(-remainingWorkSeconds)}` : '';

    // Обновляем текст на месте, чтобы hover не мигал при пересоздании узла на каждый тик таймера.
    if (existing) {
      applyContent(existing, endText, overtimeText);
      return;
    }

    const timeBold = Object.assign(document.createElement('b'), {
      className: 'text-base transition-colors hover:text-blue-600',
    });
    // px-1.5 (6px) — тот же зазор «Работаю → время», что у таймера в шапке.
    const timeButton = Object.assign(document.createElement('span'), {
      className: 'inline-flex items-center px-1.5 py-0.5 rounded-md cursor-pointer',
      title: 'Скопировать время окончания',
    });
    timeButton.append(timeBold);

    timeButton.addEventListener('click', async () => {
      await navigator.clipboard.writeText(timeBold.textContent);
      showToast({severity: 'success', summary: 'Время окончания скопировано', life: 2000});
    });

    const overtimeSpan = Object.assign(document.createElement('span'), {
      className: 'pts-worktime-overtime ml-0.5 mr-2 text-orange-500 whitespace-nowrap',
    });

    const result = Object.assign(document.createElement('span'), {
      className: 'pts-worktime-end -mr-1.5 inline-flex items-center whitespace-nowrap',
    });
    result.append('до', timeButton, overtimeSpan);
    applyContent(result, endText, overtimeText);

    const clock = mainTimer.querySelector('.bui-clock');
    clock.insertAdjacentElement('afterend', result);
  }

  render();

  rehydrateOnChanges(render, document.body, {
    filterMutation: (mutation) => mutation.target.closest(POPUP_SELECTOR),
  });
}
