// селект для фильтрации сообщений по группам
export default function addGroupFilter() {
  const blocks = [...document.querySelectorAll('div.task-messages-wrapper')];
  const messages = [...document.querySelectorAll('div.message-item')];
  if (blocks.length === 0 && messages.length === 0) return false;
 
  const groups = {};
  const select = document.createElement('select');
  select.style = `height: 30px;
                  font-size: 12px;
                  border: 1px solid #dbdbdb;
                  margin-left: 25px;
                  width: 200px;`;
  select.className = 'plan_injection_messages_filter';

  if (blocks.length > 0 && messages.length > 0) {
    blocks.forEach((block) => {
      block.classList.add('injection_group');
      const gropuA = block.querySelector('div.task-messages div.message-item div.message-message a');
      if (!gropuA) {
        block.classList.add('injection_script_filter_none');
        groups.none = ('none' in groups) ? groups.none + 1 : 1;
        return false;
      }
      const re = /в группе (.+)\)/gi;
      let groupName = re.exec(gropuA.outerHTML);
      if (!Array.isArray(groupName)) {
        block.classList.add('injection_script_filter_none');
        groups.none = ('none' in groups) ? groups.none + 1 : 1;
        return false;
      }

      groupName = groupName[1];
      if (groupName in groups) {
        groups[groupName].count++;
      } else {
        groups[groupName] = { count: 1, id: Object.keys(groups).length };
      }
      block.classList.add(`injection_script_filter_${groups[groupName].id}`);
      return true;
    });
  }

  if (blocks.length === 0 && messages.length > 0) {
    messages.forEach((message) => {
      message.classList.add('injection_group');
      const gropuA = message.querySelector('div.message-message a');
      if (!gropuA) {
        message.classList.add('injection_script_filter_none');
        groups.none = ('none' in groups) ? groups.none + 1 : 1;
        return false;
      }
      const re = /в группе (.+)\)/gi;
      let groupName = re.exec(gropuA.outerHTML);
      if (!Array.isArray(groupName)) {
        message.classList.add('injection_script_filter_none');
        groups.none = ('none' in groups) ? groups.none + 1 : 1;
        return false;
      }

      groupName = groupName[1];
      if (groupName in groups) {
        groups[groupName].count++;
      } else {
        groups[groupName] = { count: 1, id: Object.keys(groups).length };
      }
      message.classList.add(`injection_script_filter_${groups[groupName].id}`);
      return true;
    });
  }

  const optionAll = document.createElement('option');
  optionAll.value = 'all';
  optionAll.innerText = 'Все группы';
  select.appendChild(optionAll);
  if (document.querySelector('div.injection_script_filter_none')) {
    const optionNone = document.createElement('option');
    optionNone.value = 'none';
    optionNone.innerText = `Без группы (${groups.none})`;
    select.appendChild(optionNone);
  }
  const groupsSort = Object.keys(groups).sort();

  groupsSort.forEach((group) => {
    if (group === 'none') return false;
    const option = document.createElement('option');
    option.innerText = `${group} (${groups[group].count})`;
    option.value = groups[group].id;
    select.appendChild(option);
    return true;
  });

  const styles = document.createElement('style');
  styles.id = 'groupFilterInjection';
  document.head.appendChild(styles);
  select.addEventListener('change', () => {
    styles.innerHTML = (select.value === 'all')
      ? ''
      : `.injection_group {
           display: none !important;
         }
         div.injection_script_filter_${select.value} {
           display: block !important;
         }`;
  });

  const settingsBlock = document.querySelectorAll('div.settings-row');
  if (settingsBlock.length > 0) settingsBlock[settingsBlock.length - 1].appendChild(select);
  return true;
}
