<script setup>
import {onMounted, reactive, toRaw} from "vue";

// вытаскивает настройки из storage расширения и выставляет их на странице options.html
function loadOptions() {
  chrome.storage.local.get(['options'])
    .then(({options}) => {
      Object.assign(form, options);
    });
}

function saveOptions() {
  // сохраняем объект с настройками в storage расширения
  chrome.storage.local.set({
    options: toRaw(form)
  }).then(() => {
    console.log("Options is set");
  });
}

const form = reactive({
  firstName: '',
  secondName: '',
  userId: '',
  isChangeUserNameColor: false,
  nameColor: '#ff0000',
  isChangeNewCommentColor: false,
  newCommentColor: '#b7ecca',
  isQuotesNewColor: false,
  quotesBackgroundColor: '#fde08d',
  quotesBorderColor: '#1e7aa9',
  isTagallNewColor: false,
  tagallNewColor: '#f97105',
  isAddMessagesBorders: false,
  isHideLiveFeed: false,
  isReturnUsersStatus: false,
  isHideTasksImg: false,
  isTasksLikesHide: false,
  isMarkMissingUsers: false,
  isHideForumInSearchResult: false,
  isHideNotForUserMessages: false,
  isDisableShowTaskOnTagClick: false,
  isAutoChoiseFindSingleUser: false,
  isChangeTitleOnProjectPage: false,
  isAddLongLinkRepair: false,
  isAddDelAllTaskMessages: false,
  isMarkMessagesWithoutDestination: false,
  isOpenAllCommentsInTask: false,
  isAddEditTaskButton: false,
  isAddCurrentMountButton: false,
  isShowCats: false,
  isMarkMessagesToUsers: false,
  isAddGroupName: false,
  isAddAllTasksOpenButton: false,
  isAddGroupFilter: false,
});

onMounted(loadOptions);
</script>

<template>
  <form class="popup" @submit.prevent="saveOptions">
    <h1 class="popup__title">Настройки Plan Injection</h1>

    <div>
      <h2>Общие настройки</h2>
      <input v-model="form.firstName" placeholder="Ваше имя" type="text">
      <input v-model="form.secondName" placeholder="Ваша фамилия" type="text">
      <input v-model="form.userId" placeholder="ID пользователя" type="text">
    </div>

    <div>
      <h2>Настройки внешнего вида</h2>

      <div>
        <label><input v-model="form.isChangeUserNameColor" type="checkbox"> Изменить цвет имени пользователя</label>
        <input v-model="form.nameColor" type="color">
      </div>

      <div>
        <label><input v-model="form.isChangeNewCommentColor" type="checkbox"> Изменить цвет новых комментариев</label>
        <input v-model="form.newCommentColor" type="color">
      </div>

      <div>
        <label><input v-model="form.isQuotesNewColor" type="checkbox"> Изменить стили цитат</label>
        <label><input v-model="form.quotesBackgroundColor" type="color"> Фон</label>
        <label><input v-model="form.quotesBorderColor" type="color"> Рамка</label>
      </div>

      <div>
        <label><input v-model="form.isTagallNewColor" type="checkbox"> Изменить цвет TAGALL</label>
        <input v-model="form.tagallNewColor" type="color">
      </div>

      <div>
        <label><input v-model="form.isAddMessagesBorders" type="checkbox"> Добавить рамку для сообщений</label>
      </div>

      <div>
        <label><input v-model="form.isHideLiveFeed" type="checkbox"> Скрыть живую ленту</label>
      </div>

      <div>
        <label><input v-model="form.isReturnUsersStatus" type="checkbox"> Вернуть статусы юзеров в чатах
          (online)</label>
      </div>

      <div>
        <label><input v-model="form.isHideTasksImg" type="checkbox"> Скрыть изображения задач в канбане</label>
      </div>

      <div>
        <label><input v-model="form.isTasksLikesHide" type="checkbox"> Скрыть лайки у задач</label>
      </div>
    </div>

    <div>
      <h2>Расширение функционала</h2>
      <div>
        <label>
          <input v-model="form.isMarkMissingUsers" type="checkbox"> Отмечать в сообщениях задачи юзеров, которые не
          добавлены в задачу
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isHideForumInSearchResult" type="checkbox"> Убрать ссылки на форум в результатах поиска
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isHideNotForUserMessages" type="checkbox"> Закрывать уведомления, не адресованные юзеру
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isDisableShowTaskOnTagClick" type="checkbox"> Убрать открытие задачи при клике на тег в
          канбане
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isAutoChoiseFindSingleUser" type="checkbox"> Автоматически выбирать единственного
          найденного
          сотрудника при поиске через +
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isChangeTitleOnProjectPage" type="checkbox"> На страницах проектов добавить в title
          название
          проекта
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isAddLongLinkRepair" type="checkbox"> Добавить кнопку для починки длинных ссылок
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isAddDelAllTaskMessages" type="checkbox"> Добавить кнопку для удаления всех уведомлений
          текущей задачи
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isMarkMessagesWithoutDestination" type="checkbox"> Отмечать сообщения, которые никому не
          адресованы
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isOpenAllCommentsInTask" type="checkbox"> Добавить кнопку открытия всех комментариев
          задачи
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isAddEditTaskButton" type="checkbox"> Добавить кнопку редактирования задачи в канбане
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isAddCurrentMountButton" type="checkbox"> Добавить кнопку указания тега текущего месяца в
          канбане
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isShowCats" type="checkbox"> КОТИКИ!!!
        </label>
      </div>
    </div>

    <div>
      <h2>Модификация страницы /alert/</h2>
      <div>
        <label>
          <input v-model="form.isMarkMessagesToUsers" type="checkbox"> Отметить все сообщения и задачи, в которых
          упоминается юзер
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isAddGroupName" type="checkbox"> Добавить названия групп для блоков сообщений (для задач)
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isAddAllTasksOpenButton" type="checkbox"> Добавить кнопку открытия всех задач
        </label>
      </div>
      <div>
        <label>
          <input v-model="form.isAddGroupFilter" type="checkbox"> Включить фильтрацию задачи по группам
        </label>
      </div>
    </div>

    <button class="save" type="submit">Сохранить</button>
  </form>
</template>

<style scoped lang="scss">
  .popup {
    min-width: 300px;

    &__title {
      font-size: 20px;
    }
  }
</style>
