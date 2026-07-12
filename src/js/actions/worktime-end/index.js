import {rehydrateOnChanges} from '../../utils.js';

const POPUP_SELECTOR = '.intranet-avatar-widget-base-popup';
const TASK_STATUS_SELECTOR = '.intranet-avatar-widget-item__task-status';
const MAIN_TIMER_SELECTOR = '.tm-control-panel__timer.tm-timer:not(.tm-control-panel__timer_pause)';
const PAUSE_TIMER_SELECTOR = '.tm-control-panel__timer_pause.tm-timer';
const RESULT_SELECTOR = '.pts-worktime-end';

function getClockSeconds(timerElement) {
  const hours = parseInt(timerElement.querySelector('.bui-clock__value_hours')?.textContent, 10) || 0;
  const minutes = parseInt(timerElement.querySelector('.bui-clock__value_minutes')?.textContent, 10) || 0;
  const seconds = parseInt(timerElement.querySelector('.bui-clock__value_seconds')?.textContent, 10) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function formatEndTime(date) {
  return date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
}

/**
 * Показывает расчётное время окончания рабочего дня рядом с таймером «Начать/Закончить работу»
 * в попапе профиля Bitrix. Считается один раз при каждом структурном изменении попапа (открытие,
 * пауза/продолжение/завершение) — не тикает вместе с таймером каждую секунду. Пока идёт пауза,
 * рядом показывается предупреждающая иконка: если реальный перерыв затянется дольше настроенного
 * минимума, время окончания на самом деле сдвинется дальше, а показанный расчёт останется прежним
 * до перезагрузки страницы.
 * @param {number} dayHours - Длительность рабочего дня в часах.
 * @param {number} minBreakHours - Минимальный засчитываемый перерыв в часах.
 */
export function worktimeEnd(dayHours = 8, minBreakHours = 1) {
  const dayDurationSeconds = dayHours * 3600;
  const minBreakSeconds = minBreakHours * 3600;

  function render() {
    const taskStatus = document.querySelector(`${POPUP_SELECTOR} ${TASK_STATUS_SELECTOR}`);
    if (!taskStatus) return;

    taskStatus.querySelector(RESULT_SELECTOR)?.remove();

    const mainTimer = taskStatus.querySelector(MAIN_TIMER_SELECTOR);
    const title = mainTimer?.querySelector('.tm-timer__title')?.textContent.trim();
    if (!mainTimer || title === 'Не работаю') return;

    const workedSeconds = getClockSeconds(mainTimer);
    const pauseTimer = taskStatus.querySelector(PAUSE_TIMER_SELECTOR);
    const pausedSeconds = pauseTimer ? getClockSeconds(pauseTimer) : 0;
    const isPaused = mainTimer.classList.contains('tm-timer_paused');

    const remainingWorkSeconds = Math.max(0, dayDurationSeconds - workedSeconds);
    const remainingMinBreakSeconds = Math.max(0, minBreakSeconds - pausedSeconds);
    const endDate = new Date(Date.now() + (remainingWorkSeconds + remainingMinBreakSeconds) * 1000);

    const result = Object.assign(document.createElement('p'), {
      className: 'pts-worktime-end mt-2 text-sm text-surface-500 flex items-center gap-1',
      textContent: `Конец дня ≈ ${formatEndTime(endDate)}`,
    });

    if (isPaused) {
      result.appendChild(Object.assign(document.createElement('i'), {
        className: 'pi pi-exclamation-triangle text-yellow-500',
        title: 'Показано на момент паузы — перезагрузите страницу, чтобы пересчитать время после её окончания.',
      }));
    }

    taskStatus.appendChild(result);
  }

  render();

  rehydrateOnChanges(render, document.body, {
    filterMutation: (mutation) => mutation.target.closest(POPUP_SELECTOR),
  });
}
