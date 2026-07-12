import options from '../js/options.js';

(() => {
  document.body.classList.add('pts-plan');

  // Получаем session id при первой загрузке
  window.addEventListener('message', async (e) => {
    if (e?.data?.key !== 'BX_SESSION_ID' || !e?.data?.data) return;

    const sessionId = e.data.data;

    await chrome.storage.local.set({
      sessionId,
    });

    init(sessionId);
  });

  const optionActionsMap = new Map(options.map((option) => [option.key, option.action]));
  const optionNeedsMap = new Map(options.map((option) => [option.key, option.needs]));

  async function init(sessionId) {
    const { options } = await chrome.storage.local.get(['options']);

    if (!options) return;

    // console.log(options);

    Object.keys(options)
      .filter((optionKey) => {
        const optionAction = optionActionsMap.get(optionKey);
        const needs = optionNeedsMap.get(optionKey);
        return options[optionKey]
          && typeof optionAction === 'function'
          && (!needs || needs.every((k) => options[k]));
      })
      .forEach((optionKey) => {
        optionActionsMap.get(optionKey)({
          sessionId,
          options,
        });
      });
  }

  // Для всех iframe на сайте
  async function initIFrame() {
    if (window.self === window.top) return;

    const { sessionId } = await chrome.storage.local.get(['sessionId']);
    if (sessionId) {
      init(sessionId);
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
