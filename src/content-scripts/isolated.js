import alertDeleteMessage from "../functions/alert/alertDeleteMessage";
import markMessagesToUsers from "../functions/alert/markMessagesToUsers";
import addGroupName from "../functions/alert/addGroupName";
import addAllTasksOpenButton from "../functions/alert/addAllTasksOpenButton";
import addGroupFilter from "../functions/alert/addGroupFilter";
import calculateTasksCount from "../functions/alert/calculateTasksCount";
import tagAllColorChange from "../functions/common/tagAllColorChange";
import markMissingUsers from "../functions/common/markMissingUsers";
import hideForumInSearchResult from "../functions/common/hideForumInSearchResult";
import hideNotForUserMessages from "../functions/common/hideNotForUserMessages";
import disableShowTaskOnTagClick from "../functions/common/disableShowTaskOnTagClick";
import autoChoiseFindSingleUser from "../functions/common/autoChoiseFindSingleUser";
import changeTitleOnProjectPage from "../functions/common/changeTitleOnProjectPage";
import addLongLinkRepair from "../functions/common/addLongLinkRepair";
import addDelAllTaskMessages from "../functions/common/addDelAllTaskMessages";
import markMessagesWithoutDestination from "../functions/common/markMessagesWithoutDestination";
import openAllCommentsInTask from "../functions/common/openAllCommentsInTask";
import addEditTaskButton from "../functions/common/addEditTaskButton";
import addCurrentMountButton from "../functions/common/addCurrentMountButton";
import showCats from "../functions/common/showCats";

let bitrixSessid = ''; // id сессии пользователя. Вытаскивается при DOMContentLoaded

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }

  if (event.data.type && (event.data.type === "BX_SESSION_ID")) {
    bitrixSessid = event.data.text;
  }
});

chrome.storage.local.get(['options'])
  .then(({options}) => {
    if (!options) return false;

    // Инъекция стилей
    let styles = 'a.tasks-kanban-item-title{margin-right: 5px !important;}';
    Object.keys(options).forEach(key => {
      switch (key) {
        case 'userId':
          if (!isNaN(Number(options[key])) && options[key] > 0) options[key] = Number(options[key]);
          break;
        case 'nameColor':
          if (options.isChangeUserNameColor && options.userId) {
            styles += ` div.feed-com-text a[href="/company/personal/user/${options.userId}/"]{color: ${options[key]} !important;font-weight: bold !important;}`;
          }
          break;
        case 'newCommentColor':
          if (options.isChangeNewCommentColor) {
            styles += ` .feed-com-block-new{ background-color: ${options[key]}!important;}`;
          }
          break;
        case 'tagallNewColor':
          if (options.isTagallNewColor) {
            styles += ` .tagall_color{ color: ${options[key]}!important;}`;
          }
          break;
        case 'isAddMessagesBorders':
          if (options[key]) {
            styles += ' div.feed-com-main-content{border-width: 1px !important;border-style: solid !important;border-color: rgba(143,148,151,.49) !important;}';
          }
          break;
        case 'isHideLiveFeed':
          if (options[key]) {
            styles += ' div#bx-desktop-tab-im-lf, table.pagetitle-toolbar-field-view div#sidebar{display: none !important;}';
          }
          break;
        case 'isReturnUsersStatus':
          if (options[key]) {
            styles += ' span.bx-messenger-cl-status{display: inline-block !important;}';
          }
          break;
        case 'isHideTasksImg':
          if (options[key]) {
            styles += ' div.main-kanban-item a.tasks-kanban-item-image {display: none !important;}';
          }
          break;
        case 'isTasksLikesHide':
          if (options[key]) {
            styles += ' span.feed-inform-ilike.feed-new-like, div.feed-post-emoji-top-panel-outer {display: none !important;}';
          }
          break;
        case 'quotesBackgroundColor':
          if (options.isQuotesNewColor) {
            styles += ` table.forum-quote{background-color: ${options[key]} !important;`;
          }
          break;
        case 'quotesBorderColor':
          if (options.isQuotesNewColor) {
            styles += ` border-color: ${options[key]} !important;color: black !important;} table.forum-quote a{color: #2067b0 !important;}`;
          }
          break;
      }
    })
    const customStylesTag = Object.assign(document.createElement('style'), {
      innerHTML: styles,
    });
    document.body.appendChild(customStylesTag);

    // навешиваем обработчики
    scriptsInjection(options);

    if (location.href.includes('https://plan.pixelplus.ru/alert/')) alertScriptsInjection(options);

    const mutationObserver = new MutationObserver((mutationRecords) => {
      mutationRecords.forEach((mutationRecord) => {
        if (mutationRecord.type === 'childList') {
          if (mutationRecord.addedNodes.length > 0) {
            scriptsInjection(options);
          } else if (mutationRecord.removedNodes.length > 0) {
            scriptsInjection(options);
          }
        } else if (mutationRecord.type === 'attributes') {
          if (mutationRecord.attributeName === 'class' || mutationRecord.attributeName === 'style') {
            scriptsInjection(options);
          }
        }
      });
    });
    mutationObserver.observe(document, {
      childList: true, attributes: true, subtree: true, characterData: true, attributeFilter: ['class', 'style'],
    });

    window.addEventListener('focus', () => {
      scriptsInjection(options);
    });
    window.addEventListener('blur', () => {
      scriptsInjection(options);
    });
  });

function scriptsInjection(options) {
  if (options.isTagallNewColor) tagAllColorChange();
  if (options.isMarkMissingUsers) markMissingUsers();
  if (options.isHideForumInSearchResult) hideForumInSearchResult();
  if (options.isHideNotForUserMessages && options.firstName && options.secondName) hideNotForUserMessages(options.firstName, options.secondName);
  if (options.isDisableShowTaskOnTagClick) disableShowTaskOnTagClick();
  if (options.isAutoChoiseFindSingleUser) autoChoiseFindSingleUser();
  // if (options.isChangeTitleOnProjectPage) changeTitleOnProjectPage();
  if (options.isAddLongLinkRepair) addLongLinkRepair();
  if (options.isAddDelAllTaskMessages) addDelAllTaskMessages();
  if (options.isMarkMessagesWithoutDestination) markMessagesWithoutDestination();
  if (options.isOpenAllCommentsInTask) openAllCommentsInTask();
  if (options.isAddEditTaskButton) addEditTaskButton();
  if (options.isAddCurrentMountButton) addCurrentMountButton(bitrixSessid);
  if (options.isShowCats) showCats();
}

function alertScriptsInjection(options) {
  if ('isAddDelAllTaskMessages' in options) alertDeleteMessage();
  if ('isMarkMessagesToUsers' in options && 'firstName' in options && 'secondName' in options) markMessagesToUsers(options.firstName, options.secondName);
  if ('isAddGroupName' in options) addGroupName();
  if ('isAddAllTasksOpenButton' in options) addAllTasksOpenButton();
  if ('isAddGroupFilter' in options) addGroupFilter();
  calculateTasksCount();
}
