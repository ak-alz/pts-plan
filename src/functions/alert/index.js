import addDeleteAllTaskMessagesListener from './addDeleteAllTaskMessagesListener';
import markMessagesToUsers from './markMessagesToUsers';
import addGroupName from './addGroupName';
import addAllTasksOpenButton from './addAllTasksOpenButton';
import addGroupFilter from './addGroupFilter';
import calculateTasksCount from './calculateTasksCount';

function alertScriptsInjection(options) {
  calculateTasksCount();

  if (options.isAddGroupFilter) {
    addGroupFilter();
  }

  if (options.isAddDeleteAllTaskMessagesButton) {
    addDeleteAllTaskMessagesListener();
  }

  if (options.isMarkMessagesToUsers
    && options.firstName
    && options.secondName
  ) {
    markMessagesToUsers(options.firstName, options.secondName);
  }

  if (options.isAddGroupName) {
    addGroupName();
  }

  if (options.isAddAllTasksOpenButton) {
    addAllTasksOpenButton();
  }
}

export default alertScriptsInjection;
