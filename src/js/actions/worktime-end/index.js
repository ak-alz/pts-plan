import dayjs from 'dayjs';

import {showToast} from '../../toastHost/showToast.js';
import {insertCSS, rehydrateOnChanges} from '../../utils.js';

const POPUP_SELECTOR = '.intranet-avatar-widget-base-popup';
const TASK_STATUS_SELECTOR = '.intranet-avatar-widget-item__task-status';
const MAIN_TIMER_SELECTOR = '.tm-control-panel__timer.tm-timer:not(.tm-control-panel__timer_pause)';
const PAUSE_TIMER_SELECTOR = '.tm-control-panel__timer_pause.tm-timer';
const RESULT_SELECTOR = '.pts-worktime-end';
const TIME_SELECTOR = '.pts-worktime-time';
// Наш блок с временем окончания сам размечен классами bui-clock и лежит внутри таймера,
// поэтому часы самого таймера ищем в обход него
const TIMER_CLOCK_SELECTOR = `.bui-clock:not(${TIME_SELECTOR})`;
const DEFAULT_DAY_HOURS = 8;

// Вёрстка повторяет таймер Bitrix, свои правила — только на то, чего в его классах нет
const STYLES = `
  .pts-worktime-end {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .pts-worktime-time .bui-clock__value {
    cursor: pointer;
    transition: color 0.3s;
  }

  .pts-worktime-time:hover .bui-clock__value {
    color: #2563eb;
  }

  .pts-worktime-overtime {
    display: block;
    height: 16px;
  }

  .pts-worktime-overtime .ui-icon-set {
    --ui-icon-set__icon-size: 16px;
    --ui-icon-set__icon-color: #ef4444;
  }
`;

function getClockSeconds(timerElement) {
  const clock = timerElement.querySelector(TIMER_CLOCK_SELECTOR);
  if (!clock) return 0;

  const hours = parseInt(clock.querySelector('.bui-clock__value_hours')?.textContent, 10) || 0;
  const minutes = parseInt(clock.querySelector('.bui-clock__value_minutes')?.textContent, 10) || 0;
  const seconds = parseInt(clock.querySelector('.bui-clock__value_seconds')?.textContent, 10) || 0;
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
  const [endHours, endMinutes] = endText.split(':');
  const hoursValue = root.querySelector('.bui-clock__value_hours');
  const minutesValue = root.querySelector('.bui-clock__value_minutes');
  if (hoursValue.textContent !== endHours) hoursValue.textContent = endHours;
  if (minutesValue.textContent !== endMinutes) minutesValue.textContent = endMinutes;

  // Элемент не просто скрывается — при отсутствии переработки его вообще не должно быть в DOM
  let overtime = root.querySelector('.pts-worktime-overtime');
  if (!overtimeText) {
    overtime?.remove();
    return;
  }

  if (!overtime) {
    overtime = Object.assign(document.createElement('span'), {
      className: 'pts-worktime-overtime',
      innerHTML: '<div class="ui-icon-set --warning"></div>',
    });
    root.append(overtime);
  }
  if (overtime.title !== overtimeText) overtime.title = overtimeText;
}

/**
 * Показывает расчётное время окончания рабочего дня рядом с таймером «Начать/Закончить работу»
 * в попапе профиля Bitrix: текущее время + оставшееся до конца рабочего дня (длительность дня минус
 * уже отработанное) + неотгулянный остаток обеда. При переработке показывает момент выработки нормы
 * и красную иконку с величиной переработки в подсказке. Считается один раз при каждом структурном изменении попапа (открытие,
 * пауза/продолжение/завершение) — не тикает вместе с таймером каждую секунду.
 * @param {number} [dayHours=8] - Длительность рабочего дня в часах.
 * @param {number} [lunchHours=0] - Длительность обеда в часах; 0 — не учитывать обед.
 */
export function worktimeEnd(dayHours, lunchHours) {
  insertCSS(STYLES, 'worktime-end');

  // Числовое поле настройки можно очистить — тогда из storage приходит null, а не undefined,
  // и дефолт параметра не спас бы: длительность дня стала бы нулём, а весь отработанный день — переработкой
  const hours = Number(dayHours) > 0 ? Number(dayHours) : DEFAULT_DAY_HOURS;
  const dayDurationSeconds = hours * 3600;
  // Обед выключается нулём, поэтому очищенное поле (null) трактуем как 0, а не как значение по умолчанию
  const lunchDurationSeconds = Number(lunchHours) > 0 ? Number(lunchHours) * 3600 : 0;

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
    // Обед и перерыв в Bitrix — одно и то же время, а не два разных: в дне учитывается большее из них,
    // поэтому к окончанию прибавляется только неотгулянный остаток обеда
    const pauseTimer = taskStatus.querySelector(PAUSE_TIMER_SELECTOR);
    const breakSeconds = pauseTimer ? getClockSeconds(pauseTimer) : 0;
    const remainingLunchSeconds = Math.max(0, lunchDurationSeconds - breakSeconds);
    // Без Math.max: при переработке остаток отрицательный, поэтому время окончания уходит в прошлое —
    // это момент, когда норма дня была выработана. Модуль отрицательного остатка — величина переработки.
    const remainingWorkSeconds = dayDurationSeconds - workedSeconds;
    const endText = formatEndTime(dayjs().add(remainingWorkSeconds + remainingLunchSeconds, 'second'));
    const overtimeText = remainingWorkSeconds < 0 ? `Переработка ${formatDuration(-remainingWorkSeconds)}` : '';

    // Обновляем текст на месте, чтобы hover не мигал при пересоздании узла на каждый тик таймера.
    if (existing) {
      applyContent(existing, endText, overtimeText);
      return;
    }

    const label = Object.assign(document.createElement('span'), {
      className: 'tm-timer__title',
      textContent: 'до',
    });

    // Часы и минуты — отдельными значениями, как в самих часах Bitrix: так время окончания
    // наследует шрифт, размер и разделитель таймера и выглядит его частью
    const hoursValue = Object.assign(document.createElement('span'), {
      className: 'bui-clock__value bui-clock__value_hours',
    });
    const minutesValue = Object.assign(document.createElement('span'), {
      className: 'bui-clock__value bui-clock__value_minutes',
    });
    const timeButton = Object.assign(document.createElement('span'), {
      className: 'pts-worktime-time bui-clock',
      title: 'Скопировать время окончания',
    });
    timeButton.append(hoursValue, minutesValue);

    timeButton.addEventListener('click', async () => {
      const timeText = `${hoursValue.textContent}:${minutesValue.textContent}`;
      try {
        await navigator.clipboard.writeText(timeText);
        showToast({severity: 'success', summary: 'Время окончания скопировано', life: 2000});
      } catch (error) {
        // Буфер обмена может быть недоступен (нет разрешения, документ не в фокусе)
        console.warn(error);
        showToast({severity: 'error', summary: 'Не удалось скопировать время', detail: timeText, life: 5000});
      }
    });

    const result = Object.assign(document.createElement('span'), {
      className: 'pts-worktime-end',
    });
    result.append(label, timeButton);
    applyContent(result, endText, overtimeText);

    // Вставляем сразу за самими часами таймера; нет их — Bitrix перерисовал попап по-своему,
    // и вставлять расчёт некуда
    const clock = mainTimer.querySelector(TIMER_CLOCK_SELECTOR);
    if (!clock) return;

    clock.insertAdjacentElement('afterend', result);
  }

  render();

  rehydrateOnChanges(render, document.body, {
    filterMutation: (mutation) => mutation.target.closest(POPUP_SELECTOR),
  });
}
