import changeUserNameColor from './changeUserNameColor';
import changeNewCommentColor from './changeNewCommentColor';
import tagAllNewColor from './tagAllNewColor';
import addMessagesBorders from './addMessagesBorders';
import hideLiveFeed from './hideLiveFeed';
import returnUsersStatus from './returnUsersStatus';
import hideTasksImg from './hideTasksImg';
import tasksLikesHide from './tasksLikesHide';
import quotesBackgroundColor from './quotesBackgroundColor';

function stylesInjection(options) {
  // Пропускаем HTML редактор, в котором тоже есть body
  if (document.body.hasAttribute('contenteditable')) return;

  let styles = `a.tasks-kanban-item-title {
                         margin-right: 5px !important;
                       }`;
  if (options.isChangeUserNameColor
    && options.userId
    && options.nameColor
  ) {
    styles += changeUserNameColor(options.userId, options.nameColor);
  }
  if (options.isChangeNewCommentColor
    && options.newCommentColor
  ) {
    styles += changeNewCommentColor(options.newCommentColor);
  }
  if (options.isTagAllNewColor
    && options.tagAllNewColor
  ) {
    styles += tagAllNewColor(options.tagAllNewColor);
  }
  if (options.isAddMessagesBorders) {
    styles += addMessagesBorders();
  }
  if (options.isHideLiveFeed) {
    styles += hideLiveFeed();
  }
  if (options.isReturnUsersStatus) {
    styles += returnUsersStatus();
  }
  if (options.isHideTasksImg) {
    styles += hideTasksImg();
  }
  if (options.isTasksLikesHide) {
    styles += tasksLikesHide();
  }
  if (options.quotesBackgroundColor
    && options.isQuotesNewColor
    && options.quotesBorderColor
  ) {
    styles += quotesBackgroundColor(options.isQuotesNewColor, options.quotesBorderColor);
  }

  const customStylesTag = Object.assign(
    document.createElement('style'),
    {
      innerHTML: styles,
    },
  );
  document.body.appendChild(customStylesTag);
}

export default stylesInjection;
