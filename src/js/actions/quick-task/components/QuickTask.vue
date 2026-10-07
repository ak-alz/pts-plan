<script setup>
import {Avatar, Badge, Button, Checkbox, Dialog, InputText, MultiSelect, Select, SelectButton} from 'primevue';
import {computed, onMounted, reactive, ref, useTemplateRef, watch} from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import {usePersonalGroupFilter} from '../../../composables/usePersonalGroupFilter.js';
import {createEditorAttachments} from '../../../editorFiles.js';
import {refreshKanbanTask} from '../../../kanbanBridge.js';
import {showToast} from '../../../toastHost/showToast.js';
import BbcodeEditor from '../../../ui/BbcodeEditor.vue';
import EditorAttachments from '../../../ui/EditorAttachments.vue';
import FormField from '../../../ui/FormField.vue';
import {getCommitMessage, getTaskUrl} from '../../../utils.js';
import DescriptionAi from './DescriptionAi.vue';
import QuickTaskSettings from './QuickTaskSettings.vue';

const props = defineProps({
  sessionId: {type: String, required: true},
  context: {type: Object, required: true},
  stageId: {type: String, default: null},
});

const emit = defineEmits(['success']);

const isPersonal = computed(() => props.context.type === 'personal');
const contextKey = computed(() => isPersonal.value ? `personal-${props.context.id}` : props.context.id);

const api = new BitrixApi(props.sessionId);
const attachments = createEditorAttachments(api);
const settingsStorageKey = computed(() => `quick-task-settings-${contextKey.value}`);

const descriptionEditor = useTemplateRef('descriptionEditor');
const isSettingsOpen = ref(false);
const isGeneratingDescription = ref(false);
const isLoadingData = ref(false);
const isSubmitting = ref(false);
const isUploadingFiles = attachments.isUploading;

const userId = ref(null);
const currentUser = ref(null);
const users = ref([]);
// Стадии канбана выбранной группы и стадии «Моего плана» — разные сущности и живут независимо:
// задача группы попадает и в канбан группы, и в личный план её постановщика
const groupStages = ref([]);
const personalStages = ref([]);
const settings = ref({});
// Пока настройки не прочитаны, неизвестно, какое поле описания показывать: визуальный редактор,
// смонтированный заранее, пришлось бы тут же уничтожать
const isSettingsLoaded = ref(false);

// Вид поля описания — личное предпочтение, общее для всех досок
const DESCRIPTION_EDITOR_STORAGE_KEY = 'quick-task-description-editor';
const descriptionEditorMode = ref('bbcode');
const descriptionEditorOptions = [
  {label: 'Редактор', value: 'bbcode', icon: 'pi pi-pen-to-square', tip: 'Визуальный редактор Bitrix: жирный, списки, ссылки, таблицы'},
  {label: 'Текст', value: 'textarea', icon: 'pi pi-align-left', tip: 'Обычное текстовое поле'},
];

async function changeDescriptionEditorMode(mode) {
  if (!mode || mode === descriptionEditorMode.value) return;
  // Изменения из визуального редактора приходят с задержкой — забираем их, пока он не исчез
  await descriptionEditor.value?.sync();
  descriptionEditorMode.value = mode;
  await chrome.storage.local.set({[DESCRIPTION_EDITOR_STORAGE_KEY]: mode});
}

const {groupOptions, selectedGroupId, restoreGroupFilter} = usePersonalGroupFilter(
  api,
  `quick-task-group-${props.context.id}`,
);

// Группа, в которой создаётся задача: на групповом канбане это сам канбан, на личном плане —
// выбранный проект. Проект не выбран — задача уходит без группы, прямо в «Мой план»
const targetGroupId = computed(() => (isPersonal.value ? selectedGroupId.value : props.context.id) || null);
// Исполнителя и наблюдателей выбираем только когда группа известна: без неё состав участников
// взять негде, да и задача без группы всё равно достаётся текущему пользователю
const hasGroupScope = computed(() => !!targetGroupId.value);

const form = reactive({
  title: '',
  description: '',
  // Клик по «+» приходит из колонки той доски, на которой открыт виджет: на групповом канбане это
  // стадия группы, на личном плане — стадия «Моего плана»
  stageId: isPersonal.value ? null : props.stageId,
  personalStageId: isPersonal.value ? props.stageId : null,
  responsibleId: null,
  auditorIds: [],
  copyCommit: false,
});

// Что из формы знает нейросеть, кроме названия и описания
const aiProjectName = computed(() => (isPersonal.value
  ? groupOptions.value.find((group) => group.id === selectedGroupId.value)?.name ?? ''
  : ''));
const aiStageName = computed(() => {
  const stages = hasGroupScope.value ? groupStages.value : personalStages.value;
  const stageId = hasGroupScope.value ? form.stageId : form.personalStageId;
  return stages.find((stage) => stage.id === stageId)?.title ?? '';
});
const aiResponsibleName = computed(() => users.value.find((user) => user.id === form.responsibleId)?.title ?? '');

function mapStages(stagesResponse) {
  return Object.values(stagesResponse.data?.result ?? {})
    .sort((a, b) => a.SORT - b.SORT)
    .map((stage) => ({id: stage.ID, title: stage.TITLE, color: `#${stage.COLOR}`}));
}

async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get([settingsStorageKey.value, DESCRIPTION_EDITOR_STORAGE_KEY]);
    settings.value = stored[settingsStorageKey.value] ?? {};
    descriptionEditorMode.value = stored[DESCRIPTION_EDITOR_STORAGE_KEY] ?? 'bbcode';
  } catch { /* ignore */ } finally {
    isSettingsLoaded.value = true;
  }
}

function applyDefaults() {
  form.copyCommit = !!(settings.value.showCommitCheckbox && settings.value.copyCommitDefault);
  // Значения по умолчанию заданы для участников канбана этой страницы. На личном плане состав
  // зависит от выбранного проекта и заранее неизвестен — там исполнитель сам пользователь
  form.responsibleId = isPersonal.value ? userId.value : (settings.value.defaultResponsible ?? userId.value);
  form.auditorIds = isPersonal.value ? [] : (settings.value.defaultAuditors ?? []);
}

// Без группы исполнитель всегда сам пользователь: селект скрыт, но значение формы должно
// на кого-то ссылаться
function getCurrentUserOptions() {
  const user = currentUser.value;
  if (!user) return [];
  return [{
    id: Number(user.ID),
    title: [user.NAME, user.LAST_NAME].filter(Boolean).join(' '),
    avatar: user.PERSONAL_PHOTO ?? '',
  }];
}

// Под какую группу уже загружены участники и стадии. Первая загрузка идёт через этот же вызов,
// поэтому наблюдатель за selectedGroupId её не дублирует
let loadedGroupId;
let latestScopeRequestId = 0;

async function loadGroupScope() {
  const groupId = targetGroupId.value;
  if (loadedGroupId === groupId) return;
  loadedGroupId = groupId;

  // Без группы участников и её стадий не существует, запрашивать нечего
  if (!groupId) {
    users.value = getCurrentUserOptions();
    groupStages.value = [];
    return;
  }

  const requestId = ++latestScopeRequestId;
  isLoadingData.value = true;
  try {
    const [groupUsers, stagesResponse] = await Promise.all([
      api.getGroupUsers(groupId),
      api.getStages(groupId),
    ]);
    // Проект успели сменить, пока шёл запрос — ответ уже не о той группе
    if (requestId !== latestScopeRequestId) return;

    users.value = groupUsers.map((user) => ({
      id: Number(user.ID),
      title: [user.NAME, user.LAST_NAME].filter(Boolean).join(' '),
      avatar: user.PERSONAL_PHOTO ?? '',
    }));
    groupStages.value = mapStages(stagesResponse);
    // Первая колонка канбана как значение по умолчанию. Только если стадия ещё не выбрана: на
    // групповом канбане она уже пришла из колонки, по которой кликнули «+»
    if (!form.stageId) form.stageId = groupStages.value[0]?.id ?? null;
  } catch (error) {
    // Группа не должна запомниться загруженной, иначе повторный выбор той же группы ничего не даст
    if (requestId === latestScopeRequestId) loadedGroupId = undefined;
    console.warn(error);
    showToast({severity: 'error', summary: 'Не удалось загрузить данные', life: 3000});
  } finally {
    if (requestId === latestScopeRequestId) isLoadingData.value = false;
  }
}

// Участники и стадии прошлого проекта к новому отношения не имеют: оставшийся выбор ссылался бы
// на чужую группу, а форма отправила бы стадию, которой в новой группе нет. Стадию «Моего плана»
// не трогаем — она от проекта не зависит
watch(selectedGroupId, () => {
  form.stageId = null;
  form.responsibleId = userId.value;
  form.auditorIds = [];
  loadGroupScope();
});

async function onSettingsSaved() {
  await loadSettings();
  isSettingsOpen.value = false;
}

// Создать задачу можно раньше, чем догрузятся пользователь и настройки: название вбивают сразу и
// жмут Enter. Без ожидания исполнитель ещё пуст, и форма отвечала «Выберите исполнителя»
let initialLoad = Promise.resolve();

onMounted(() => {
  initialLoad = loadInitialData();
});

async function loadInitialData() {
  isLoadingData.value = true;
  try {
    const [loadedUser, personalStagesResponse] = await Promise.all([
      api.getCurrentUser(),
      // Стадии «Моего плана» от выбранного проекта не зависят, поэтому грузятся один раз.
      // task.stages.get всегда отдаёт «Мой план» ТЕКУЩЕГО пользователя строго по entityId=0,
      // а не по его userId — иначе ACCESS_DENIED (проверено на реальном канбане)
      isPersonal.value ? api.getStages('0') : Promise.resolve(null),
      loadSettings(),
      // Выбранный в прошлый раз проект запоминается композаблом — восстанавливаем до загрузки
      // участников и стадий, чтобы они сразу пришли по нужной группе
      isPersonal.value ? restoreGroupFilter() : Promise.resolve(),
    ]);

    currentUser.value = loadedUser;
    userId.value = loadedUser ? Number(loadedUser.ID) : null;
    if (personalStagesResponse) {
      personalStages.value = mapStages(personalStagesResponse);
      // Обычно стадия уже пришла из колонки, по которой кликнули «+», — подстраховка на случай,
      // когда её не удалось определить
      if (!form.personalStageId) form.personalStageId = personalStages.value[0]?.id ?? null;
    }
    applyDefaults();
  } catch (error) {
    console.warn(error);
    showToast({severity: 'error', summary: 'Не удалось загрузить данные', life: 3000});
  } finally {
    isLoadingData.value = false;
  }

  // Свой индикатор загрузки внутри — поэтому вне try выше
  await loadGroupScope();
}

async function submit() {
  const title = form.title.trim();
  if (!title || isSubmitting.value || isUploadingFiles.value) return;
  isSubmitting.value = true;
  try {
    await Promise.all([initialLoad, descriptionEditor.value?.sync()]);
    await createTask(title);
  } finally {
    isSubmitting.value = false;
  }
}

async function createTask(title) {
  if (isPersonal.value && !form.personalStageId) {
    showToast({severity: 'warn', summary: 'Выберите стадию в «Мой план»', life: 3000});
    return;
  }
  if (hasGroupScope.value && !form.stageId) {
    showToast({
      severity: 'warn',
      summary: isPersonal.value ? 'Выберите стадию в проекте' : 'Выберите стадию',
      life: 3000,
    });
    return;
  }
  if (!form.responsibleId) {
    showToast({severity: 'warn', summary: 'Выберите исполнителя', life: 3000});
    return;
  }
  try {
    const groupId = targetGroupId.value;
    const fields = {TITLE: title, GROUP_ID: groupId ?? '0'};
    // Стадию канбана группы tasks.task.add принимает сам. Стадию «Моего плана» — нет: она отдельная
    // сущность, и задача с ней не создаётся вовсе, поэтому ставится переносом после создания
    if (form.stageId && groupId) fields.STAGE_ID = form.stageId;
    if (form.responsibleId) fields.RESPONSIBLE_ID = form.responsibleId;
    if (form.description.trim()) fields.DESCRIPTION = form.description.trim();
    if (form.auditorIds.length) fields.AUDITORS = form.auditorIds;

    const {data} = await api.addTask(fields);
    const taskId = String(data?.result?.task?.id ?? data?.result?.task?.ID ?? '');
    // Успех — только когда Bitrix вернул ID созданной задачи: 4xx поймает axios, но отказ приходит
    // и как 200 с полем error, и тогда виджет отчитался бы о создании впустую
    if (!taskId) throw new Error(data?.error_description || 'Bitrix не подтвердил создание задачи');

    // Задача уже есть — закрываем окно, не дожидаясь переноса в стадию: это ещё один запрос,
    // и с ним окно висело больше секунды против мгновенного черновика в форме Bitrix
    const personalStageId = form.personalStageId;
    emit('success');

    if (form.copyCommit) {
      const commitMessage = getCommitMessage(title, taskId);
      try {
        await navigator.clipboard.writeText(commitMessage);
        showToast({severity: 'info', summary: 'Текст коммита скопирован', detail: commitMessage, life: 5000});
      } catch { /* ignore */ }
    }

    // Неудавшиеся перенос и прикрепление файлов задачу не отменяют — только предупреждаем
    const warnings = [];
    await Promise.all([
      (async () => {
        if (!personalStageId) return;
        try {
          const {data: moveData} = await api.moveTaskToStage(taskId, personalStageId);
          if (!moveData?.result) throw new Error(moveData?.error_description || 'Bitrix не подтвердил перенос задачи');
        } catch (error) {
          console.warn(error);
          warnings.push('Перенести её в выбранную колонку «Моего плана» не удалось — колонку можно задать перетаскиванием.');
        }
      })(),
      attachments.attachToTask(taskId).catch((error) => {
        console.warn(error);
        warnings.push('Не все файлы прикрепились к задаче — вставленные в описание изображения могут не отображаться.');
      }),
    ]);

    // Задача создана через REST, и сама доска о ней не узнает до перезагрузки страницы. Карточку
    // запрашиваем после переноса, иначе на личном плане она встала бы не в ту колонку
    refreshKanbanTask(taskId);

    const taskUrl = settings.value.showCreatedTask ? getTaskUrl(groupId ?? '0', taskId, userId.value) : null;
    showToast({
      severity: warnings.length ? 'warn' : 'success',
      summary: 'Задача создана',
      detail: warnings.length ? warnings.join(' ') : undefined,
      links: taskUrl ? [{ url: taskUrl, label: title }] : undefined,
      life: taskUrl ? 8000 : 3000,
    });
  } catch (error) {
    console.warn(error);
    showToast({severity: 'error', summary: 'Ошибка создания задачи', detail: error.message, life: 5000});
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 pt-1">
    <div class="mb-3">
      <Button
        icon="pi pi-cog"
        label="Настройки"
        size="small"
        severity="secondary"
        text
        @click="isSettingsOpen = true"
      />
    </div>

    <FormField label="Название">
      <InputText
        v-model="form.title"
        placeholder="Название задачи"
        autofocus
        fluid
        @keydown.enter.prevent="submit"
      />
    </FormField>

    <div>
      <div class="flex items-center justify-between gap-2 mb-1">
        <span class="text-surface-500 dark:text-surface-400 text-sm font-semibold">Описание</span>
        <SelectButton
          :model-value="descriptionEditorMode"
          :options="descriptionEditorOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          :disabled="isGeneratingDescription"
          size="small"
          @update:model-value="changeDescriptionEditorMode"
        >
          <template #option="{ option }">
            <span
              v-tooltip.top="option.tip"
              class="flex items-center gap-1"
            >
              <i :class="option.icon" />
              {{ option.label }}
            </span>
          </template>
        </SelectButton>
      </div>
      <BbcodeEditor
        v-if="isSettingsLoaded"
        ref="descriptionEditor"
        :key="descriptionEditorMode"
        v-model="form.description"
        :plain="descriptionEditorMode === 'textarea'"
        :files="attachments.imageInfos.value"
        :upload-image="attachments.uploadImage"
        :disabled="isGeneratingDescription"
        placeholder="Описание задачи (необязательно). Изображение можно вставить через Ctrl+V или перетащить сюда"
      />
      <EditorAttachments
        v-if="isSettingsLoaded"
        v-model:text="form.description"
        :attachments="attachments"
        :editor="descriptionEditor"
        :disabled="isGeneratingDescription"
        class="mt-1"
      />
    </div>

    <DescriptionAi
      v-if="isSettingsLoaded && !settings.hideAi"
      v-model:description="form.description"
      v-model:generating="isGeneratingDescription"
      :board-key="contextKey"
      :sync-description="() => descriptionEditor?.sync()"
      :title="form.title"
      :project-name="aiProjectName"
      :stage-name="aiStageName"
      :responsible-name="aiResponsibleName"
    />

    <div
      v-if="isPersonal"
      class="grid grid-cols-2 gap-3"
    >
      <FormField
        label="Проект"
        tip="Задача создаётся в выбранном проекте: стадия, исполнитель и наблюдатели берутся из его канбана. Пусто — задача уходит без проекта, прямо в «Мой план»"
      >
        <Select
          v-model="selectedGroupId"
          :options="groupOptions"
          option-value="id"
          option-label="name"
          placeholder="Без проекта"
          show-clear
          filter
          filter-placeholder="Поиск"
          fluid
        />
      </FormField>

      <FormField
        label="Стадия в «Мой план»"
        tip="Колонка личного канбана, в которую попадёт задача. От проекта не зависит: задача проекта видна и в его канбане, и в личном плане постановщика"
      >
        <Select
          v-model="form.personalStageId"
          option-value="id"
          option-label="title"
          :options="personalStages"
          :loading="isLoadingData"
          fluid
          placeholder="Выбрать"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Badge :style="`background-color: ${option.color};`" />
              {{ option.title }}
            </div>
          </template>
        </Select>
      </FormField>
    </div>

    <div
      v-if="hasGroupScope"
      class="grid grid-cols-3 gap-3"
    >
      <FormField label="Исполнитель">
        <Select
          v-model="form.responsibleId"
          option-value="id"
          option-label="title"
          :options="users"
          :loading="isLoadingData"
          filter
          filter-placeholder="Поиск"
          fluid
          placeholder="Выбрать"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Avatar
                v-if="option.avatar"
                :image="option.avatar"
                shape="circle"
              />
              {{ option.title }}
            </div>
          </template>
        </Select>
      </FormField>

      <FormField :label="isPersonal ? 'Стадия в проекте' : 'Стадия'">
        <Select
          v-model="form.stageId"
          option-value="id"
          option-label="title"
          :options="groupStages"
          :loading="isLoadingData"
          fluid
          placeholder="Выбрать"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Badge :style="`background-color: ${option.color};`" />
              {{ option.title }}
            </div>
          </template>
        </Select>
      </FormField>

      <FormField label="Наблюдатели">
        <MultiSelect
          v-model="form.auditorIds"
          option-value="id"
          option-label="title"
          :options="users"
          :loading="isLoadingData"
          filter
          filter-placeholder="Поиск"
          :max-selected-labels="2"
          fluid
          placeholder="Выбрать"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Avatar
                v-if="option.avatar"
                :image="option.avatar"
                shape="circle"
              />
              {{ option.title }}
            </div>
          </template>
        </MultiSelect>
      </FormField>
    </div>

    <div
      v-if="settings.showCommitCheckbox"
      class="flex gap-2 items-center"
    >
      <Checkbox
        v-model="form.copyCommit"
        binary
        input-id="qt-copy-commit"
      />
      <label
        for="qt-copy-commit"
        class="text-sm cursor-pointer select-none"
      >Копировать текст коммита</label>
      <i
        v-tooltip.top="'После создания задачи текст коммита будет скопирован в буфер обмена'"
        class="pi pi-question-circle"
      />
    </div>

    <div class="flex">
      <Button
        label="Создать"
        :loading="isSubmitting"
        :disabled="!form.title.trim() || isUploadingFiles"
        @click="submit"
      />
    </div>
  </div>

  <Dialog
    v-model:visible="isSettingsOpen"
    header="Настройки быстрой задачи"
    modal
    dismissable-mask
  >
    <QuickTaskSettings
      :initial="settings"
      :settings-storage-key="settingsStorageKey"
      :users="users"
      :current-user-id="userId"
      :is-personal="isPersonal"
      @success="onSettingsSaved"
    />
  </Dialog>
</template>
