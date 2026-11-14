import options from '../js/options.js';
import {initToastHost} from '../js/toastHost/index.js';
import {isBitrixDarkThemeActive, onBitrixDarkThemeChange} from '../js/utils.js';

(() => {
  document.body.classList.add('pts-plan');

  // Получаем session id при первой загрузке
  window.addEventListener('message', async (event) => {
    // Сообщение обязано прийти из этого же окна и с этого же origin: слушатель принимает sessid,
    // который затем ложится в chrome.storage и используется всеми фичами (в том числе в других
    // вкладках и во всех iframe) — без проверки любой сторонний скрипт или iframe страницы мог бы
    // подменить его своим значением
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.key !== 'BX_SESSION_ID' || !event.data?.data) return;

    const sessionId = event.data.data;
    const {sessionIds = {}} = await chrome.storage.local.get(['sessionIds']);

    await chrome.storage.local.set({
      sessionId,
      // Домен Bitrix намеренно не хардкодится (расширение работает и на *.bitrix24.ru) — страницы
      // расширения (попап, «Что нового») берут его отсюда, чтобы обратиться к API без хардкода
      bitrixOrigin: window.location.origin,
      // Тот же sessid, но по каждому порталу отдельно — для iframe (см. initIFrame): одиночный ключ
      // выше принадлежит порталу, открытому последним, и вкладке другого портала не подходит.
      // Чтение и запись карты не атомарны: два разных портала, загрузившиеся в один момент, могут
      // затереть запись друг друга — тогда во фреймах одного из них фичи не запустятся до
      // перезагрузки его страницы. Случай редкий, отдельных ключей на портал ради него не заводим:
      // их пришлось бы исключать из выгрузки настроек по шаблону
      sessionIds: {...sessionIds, [window.location.origin]: sessionId},
    });

    init(sessionId);
  });

  const optionActionsMap = new Map(options.map((option) => [option.key, option.action]));
  const optionNeedsMap = new Map(options.map((option) => [option.key, option.needs]));

  async function init(sessionId) {
    const { options } = await chrome.storage.local.get(['options']);

    if (!options) return;

    Object.keys(options)
      .filter((optionKey) => {
        const optionAction = optionActionsMap.get(optionKey);
        const needs = optionNeedsMap.get(optionKey);
        return options[optionKey]
          && typeof optionAction === 'function'
          && (!needs || needs.every((k) => options[k]));
      })
      .forEach((optionKey) => {
        // Каждая фича запускается изолированно: раньше синхронное исключение в одной обрывало
        // весь forEach, и все следующие по порядку фичи молча не стартовали. Промис ловим отдельно —
        // почти все action асинхронные, и их ошибки иначе уходили в unhandled rejection без следов
        try {
          Promise.resolve(optionActionsMap.get(optionKey)({
            sessionId,
            options,
          })).catch((error) => console.warn(`[pts-plan] ${optionKey}`, error));
        } catch (error) {
          console.warn(`[pts-plan] ${optionKey}`, error);
        }
      });
  }

  // Для всех iframe на сайте
  async function initIFrame() {
    if (window.self === window.top) return;

    const frameOrigin = window.location.origin;
    const {sessionId, bitrixOrigin, sessionIds} = await chrome.storage.local.get(['sessionId', 'bitrixOrigin', 'sessionIds']);
    // Одиночный ключ годится, только если он записан этим же порталом (страница открыта ещё до
    // обновления расширения и в карту ничего не записала). Фрейм чужого сайта, встроенный в портал
    // или встроивший его, своего sessid не получает
    const frameSessionId = sessionIds?.[frameOrigin] ?? (bitrixOrigin === frameOrigin ? sessionId : null);
    if (frameSessionId) {
      init(frameSessionId);
    }
  }

  initIFrame();

  function injectMainScript() {
    if (window.self === window.top) {
      const script = Object.assign(document.createElement('script'), {
        src: chrome.runtime.getURL('src/content-scripts/main.js'),
        type: 'module',
      });
      document.head.appendChild(script);

      script.onload = () => {
        script.remove();
      };
    }
  }

  injectMainScript();

  function injectStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('assets/content-styles.css');
    document.head.appendChild(link);
  }

  injectStyles();

  initToastHost();

  // Виджеты тёмные, если тёмная тема выбрана явно или на странице работает «Тёмная тема Битрикса»
  let currentThemeMode;

  function applyContentTheme(themeMode) {
    currentThemeMode = themeMode;
    document.documentElement.classList.toggle('pts-dark', themeMode === 'dark' || isBitrixDarkThemeActive());
  }

  onBitrixDarkThemeChange(() => applyContentTheme(currentThemeMode));

  async function initTheme() {
    const { themeMode } = await chrome.storage.local.get(['themeMode']);
    applyContentTheme(themeMode);
  }

  initTheme();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.themeMode) {
      applyContentTheme(changes.themeMode.newValue);
    }
  });

  const easterEggImages = [
    `@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@%*-===-:--=@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@+----..:.::.:::::-+@@@@@@@@@@@@@@@@
@@@@@@@@@@@@#-:----:.:.:::::::::::::@@@@@@@@@@@@@@
@@@@@@@@@@@-:::::-::--:--:=-:-==-==--*@@@@@@@@@@@@
@@@@@@@@@-::.::.---==--====++++++++*+==#@@@@@@@@@@
@@@@@@@%.:...:.:-=*====+*++*#**#*###***-+@@@@@@@@@
@@@@@@%.:...::==+#*+#+*%#%*%%#%@#@@%#*++=-@@@@@@@@
@@@@@@:.:..-=*#*%%%@@%@@@@@@@@@@@@@@@#+#*=+@@@@@@@
@@@@@%.:.:=##%@@@@@@@@@@@@@@@@@@@@@@@@#***=#@@@@@@
@@@@@=...-*#%@@@@@@@@@@@@@@@@@@@@@@@@@@***++@@@@@@
@@@@@*..:=*-:::..::-+*%@@@%#+++===++%@@#*+++@@@@@@
@@@@@@:..+==++++=-:::-+%@@%#*++*#%%@@@@%**+#@@@@@@
@@@@@@:..+*+-:-:::--:-+@@@@@#*=:-+##%@@@*+*@@@@@@@
@@@@@@#..*#*===+***+=+*%@@@@@%#%%@@@@@@@*+%@@@@@@@
@@@@@@*:+#%@@@@@@@%%#**%@@@@@@@@@@@@@@@@%@@@@@@@@@
@@@@@@-+**%@@@@@@@@%#*#@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@*++**#%@@@@@@#*+*%@@@@@@@@@@@@@@@@@%@@@@@@@@
@@@@@@*-+++*#%%@@@%#+=:-*%+%@@@@@@@@@@@@@@@@@@@@@@
@@@@@@#++++**#%@@@%%*+=#%@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@#+++**#%%@@%%##%@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@*+**###%%%*==+*###@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@+*****#%**#%@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@*+****##****+-+%@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@+++++***#%%%@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@+++=+##%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@++===+**##%@%@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@*++=---=+*##**#%%%%%%@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@**++==-==++**++***%@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@#**++====-==*#%@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@******++++*%@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@:..**####*****#@@@@@@@@@@@@@@.:-@@@@@@@@@
@@@@@@+....**###%%%###%%@@@@@@@@@@@@@@=..:-+@@@@@@
@@@@@+...:**####%@@%#%@@@@@@@@@@@@@@@@@*.:--=+@@@@
@.......*#*#####%@@@%%@@@@@@@@@@@@@@@@@@%=:----=--
.......:#@%#%%%%#%@@@@%@@@@@@@@@@@@@@@@@@=:-------`,
    `@@@@@@@@@@@%@%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@=-=:..:+#%@@@@+:#@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@::::.......:-=:.:*@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@+--::.........::::-=#@@@@@@@@@@@@@@@@@@@
@@@@%@@@@@=-:::.::::::::.:::::--::-+#%@@@@@@@@@@@@
@@@-:.-:....:::.............:::::::::::::--=%@@@@@
@@@%-:-..........:.:........:::::::::::::::::-%@@@
@@@@#--:...........:::::.........:::::::::::::%@@@
@@@@#--:.........-:...:::::-..........::::::-*@@@@
@@@@+-::::..:::::::::..:--:::-:-::::::::-++#%%@@@@
@@@@+-::::::::::::..::::---:::::-++*******#%%@@@@@
@@@@%=:::...:.........:::::::::::::::-+##%@@@@@@@@
@@@@%%#=-:::.::.........::::::::::::::::::-+@@@@@@
@@@@@##%%##+--:::::::::.::::::::::::::::::::-@@@@@
@@@@@@@***###%#+::::::::::::::::::::::::::::-%@@@@
@@@@@@@@@@@%#***##*::..:::::::::::::::::::::+@@@@@
@@@@@@@@@@@@@@@@@%**#+:::::::::::::::::::::+%@@@@@
@@@@@@@@@@@@@@@@@@@@%#**+-:::::::::::::-+*#%@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@%##*+++++++++**##%%@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%#%%%%@@@@@@@@@@@@`,
  ];

  function printEasterEgg() {
    const image = easterEggImages[Math.floor(Math.random() * easterEggImages.length)];

    const styles = [
      'font-family: monospace',
      'line-height: 0.8',
      'font-size: 14px',
      'color: #4CAF50',
      'white-space: pre',
      'letter-spacing: unset',
      'transform: unset',
    ].join(';');

    console.log(`%c${image.replaceAll('%', '%%')}`, styles);
  }

  printEasterEgg();
})();
