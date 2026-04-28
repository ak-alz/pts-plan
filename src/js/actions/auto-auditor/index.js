(() => {
  function init() {
    if (!/\/tasks\/task\/edit\/0(?:\/|\?|$)/.test(window.location.href)) return;

    const addBtn = document.querySelector('.add[data-field="auditor"]');
    const targetBtn = document.querySelector('[data-target="auditor"]');

    if (!addBtn && !targetBtn) {
      setTimeout(init, 500);
      return;
    }

    addBtn?.click();
    targetBtn?.click();
  }

  init();
})();
