export default function setEventListeners(callback) {
  const mutationObserver = new MutationObserver((mutationRecords) => {
    mutationRecords.forEach((mutationRecord) => {
      if (mutationRecord.type === 'childList') {
        if (mutationRecord.addedNodes.length > 0) {
          callback();
        } else if (mutationRecord.removedNodes.length > 0) {
          callback();
        }
      } else if (mutationRecord.type === 'attributes') {
        if (mutationRecord.attributeName === 'class' || mutationRecord.attributeName === 'style') {
          callback();
        }
      }
    });
  });

  mutationObserver.observe(document, {
    childList: true,
    attributes: true,
    subtree: true,
    characterData: true,
    attributeFilter: ['class', 'style'],
  });

  window.addEventListener('focus', callback);
  window.addEventListener('blur', callback);
}
