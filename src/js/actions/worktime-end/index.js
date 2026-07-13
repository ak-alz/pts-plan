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

function formatEndTime(date) {
  return date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
}

/**
 * Показывает расчётное время окончания рабочего дня рядом с таймером «Начать/Закончить работу»
 * в попапе профиля Bitrix: текущее время + оставшееся до конца рабочего дня (длительность дня минус
 * уже отработанное). Считается один раз при каждом структурном изменении попапа (открытие,
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
    const remainingWorkSeconds = Math.max(0, dayDurationSeconds - workedSeconds);
    const endText = formatEndTime(new Date(Date.now() + remainingWorkSeconds * 1000));

    // Обновляем текст на месте, чтобы hover не мигал при пересоздании узла на каждый тик таймера.
    if (existing) {
      existing.querySelector('b').textContent = endText;
      return;
    }

    const timeBold = Object.assign(document.createElement('b'), {
      className: 'text-base',
      textContent: endText,
    });
    const copyIcon = Object.assign(document.createElement('i'), {
      className: 'pi pi-copy text-gray-400',
    });

    // px-1.5 (6px) — тот же зазор «Работаю → время», что у таймера в шапке.
    const timeButton = Object.assign(document.createElement('span'), {
      className: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors hover:bg-black/5',
      title: 'Скопировать время окончания',
    });
    timeButton.append(timeBold, copyIcon);

    timeButton.addEventListener('click', async () => {
      await navigator.clipboard.writeText(timeBold.textContent);
      copyIcon.classList.replace('pi-copy', 'pi-check');
      setTimeout(() => copyIcon.classList.replace('pi-check', 'pi-copy'), 1500);
    });

    const result = Object.assign(document.createElement('span'), {
      className: 'pts-worktime-end ml-2 inline-flex items-center whitespace-nowrap',
    });
    result.append('Закончу', timeButton);

    mainTimer.insertAdjacentElement('afterend', result);
  }

  render();

  rehydrateOnChanges(render, document.body, {
    filterMutation: (mutation) => mutation.target.closest(POPUP_SELECTOR),
  });
}
