import tagAllColorChange from './tagAllColorChange';
import markMissingUsers from './markMissingUsers';
import hideForumInSearchResult from './hideForumInSearchResult';
import hideNotForUserMessages from './hideNotForUserMessages';
import disableShowTaskOnTagClick from './disableShowTaskOnTagClick';
import autoChoiseFindSingleUser from './autoChoiseFindSingleUser';
import changeTitleOnProjectPage from './changeTitleOnProjectPage';
import addLongLinkRepair from './addLongLinkRepair';
import addDeleteAllTaskMessagesButton from './addDeleteAllTaskMessagesButton';
import markMessagesWithoutDestination from './markMessagesWithoutDestination';
import openAllCommentsInTask from './openAllCommentsInTask';
import addEditTaskButton from './addEditTaskButton';
import addCurrentMountButton from './addCurrentMountButton';
import showCats from './showCats';
import scrumPoints from './scrumPoints';
import scrumSummary from './scrumSummary';
import commitButton from './commitButton';

function scriptsInjection(options, bitrixSessionId) {
  if (options.isTagAllNewColor) {
    tagAllColorChange();
  }
  if (options.isMarkMissingUsers) {
    markMissingUsers();
  }
  if (options.isHideForumInSearchResult) {
    hideForumInSearchResult();
  }
  if (options.isHideNotForUserMessages
    && options.firstName
    && options.secondName
  ) {
    hideNotForUserMessages(options.firstName, options.secondName);
  }
  if (options.isDisableShowTaskOnTagClick) {
    disableShowTaskOnTagClick();
  }
  if (options.isAutoChoiseFindSingleUser) {
    autoChoiseFindSingleUser();
  }
  if (options.isChangeTitleOnProjectPage) {
    changeTitleOnProjectPage();
  }
  if (options.isAddLongLinkRepair) {
    addLongLinkRepair();
  }
  if (options.isAddDeleteAllTaskMessagesButton) {
    addDeleteAllTaskMessagesButton(bitrixSessionId);
  }
  if (options.isMarkMessagesWithoutDestination) {
    markMessagesWithoutDestination();
  }
  if (options.isOpenAllCommentsInTask) {
    openAllCommentsInTask();
  }
  if (options.isAddEditTaskButton) {
    addEditTaskButton();
  }
  if (options.isAddCurrentMountButton) {
    addCurrentMountButton(bitrixSessionId);
  }
  if (options.isShowCats) {
    showCats();
  }
  if (options.isScrumPoints) {
    scrumPoints(bitrixSessionId);
  }
  if (options.isScrumSummary) {
    scrumSummary(bitrixSessionId);
  }
  if (options.isCommitButton) {
    commitButton();
  }
}

export default scriptsInjection;
