import {SET_BITRIX_DARK_THEME_MESSAGE_TYPE} from '../../messages.js';
import {showToast} from '../../toastHost/showToast.js';
import {insertCSS, isBitrixDarkThemeActive, onBitrixDarkThemeChange, waitForElement} from '../../utils.js';

// Рядом с кнопкой «Помощь» в шапке; блок NPS портала стоит правее за счёт своего CSS order
const ANCHOR_SELECTOR = '.air-header__personal-info .air-header__buttons';
const BUTTON_CLASS = 'pts-theme-button';

const MOON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const SUN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';

const CSS = `
  .pts-theme-button-wrapper { margin-left: 8px; margin-right: 12px; }
  .${BUTTON_CLASS} { display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 24px; height: 24px; padding: 0; border-radius: 50%; }
  .${BUTTON_CLASS} svg { width: 15px; height: 15px; flex-shrink: 0; }
  .${BUTTON_CLASS}:disabled { cursor: progress; opacity: 0.6; }
`;

// Иконка показывает, во что переключит кнопка: луна — в тёмную, солнце — в светлую
function renderButton(button) {
  const isDark = isBitrixDarkThemeActive();
  button.innerHTML = isDark ? SUN_ICON : MOON_ICON;
  button.title = isDark ? 'Светлая тема' : 'Тёмная тема';
}

async function toggleTheme(button) {
  button.disabled = true;

  try {
    // Тема переключается сразу во всех открытых вкладках портала, иконку обновит onBitrixDarkThemeChange
    const response = await chrome.runtime.sendMessage({type: SET_BITRIX_DARK_THEME_MESSAGE_TYPE, enabled: !isBitrixDarkThemeActive()});
    if (!response?.ok) throw new Error(response?.error ?? 'нет ответа');
  } catch (error) {
    console.warn('[pts-plan] bitrixDarkThemeButton', error);
    showToast({
      severity: 'error',
      summary: 'Не удалось переключить тему',
      // После обновления расширения старая вкладка теряет связь с ним
      detail: 'Обновите страницу и попробуйте ещё раз.',
      life: 5000,
    });
  } finally {
    button.disabled = false;
  }
}

export async function bitrixDarkThemeButton() {
  if (window.top !== window.self) return;

  const anchor = await waitForElement(ANCHOR_SELECTOR);
  if (!anchor || document.querySelector(`.${BUTTON_CLASS}`)) return;

  insertCSS(CSS, 'pts-theme-button-styles');

  const button = Object.assign(document.createElement('button'), {
    type: 'button',
    className: `air-header-button ${BUTTON_CLASS}`,
  });
  renderButton(button);
  button.addEventListener('click', () => toggleTheme(button));
  onBitrixDarkThemeChange(() => renderButton(button));

  const wrapper = Object.assign(document.createElement('div'), {
    className: 'air-header__button pts-theme-button-wrapper',
  });
  wrapper.append(button);
  anchor.after(wrapper);
}
