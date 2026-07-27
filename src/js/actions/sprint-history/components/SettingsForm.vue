<script setup>
import {Avatar, Button, MultiSelect, Select, ToggleSwitch} from 'primevue';
import {onMounted, reactive, ref, toRaw} from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import {showToast} from '../../../toastHost/showToast.js';
import FormField from '../../../ui/FormField.vue';
import {PERIOD_OPTIONS, ROOT_STATUS_OPTIONS} from '../variables.js';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  groupId: {
    type: String,
    required: true,
  },
  stages: {
    type: Array,
    default: () => [],
  },
  initial: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['success']);

const bitrixApi = new BitrixApi(props.sessionId);

const isLoading = ref(false);
const isUsersLoading = ref(false);
const groupUsers = ref([]);

const userOptions = ref([]);

const form = reactive({
  defaultPeriod: props.initial.defaultPeriod ?? 'prevWeek',
  defaultResponsibleId: props.initial.defaultResponsibleId ?? null,
  defaultExcludeHotfixes: props.initial.defaultExcludeHotfixes ?? false,
  defaultGroupByParent: props.initial.defaultGroupByParent ?? false,
  defaultStageIds: props.initial.defaultStageIds ?? [],
  defaultRootStatus: props.initial.defaultRootStatus ?? 'all',
});

onMounted(async () => {
  isUsersLoading.value = true;
  try {
    groupUsers.value = await bitrixApi.getGroupUsers(props.groupId);
    userOptions.value = groupUsers.value.map((user) => ({
      id: String(user.ID),
      name: [user.NAME, user.LAST_NAME].filter(Boolean).join(' '),
      photo: user.PERSONAL_PHOTO || null,
    }));
  } catch (e) {
    console.warn('[sprint-history] failed to load group users:', e);
  } finally {
    isUsersLoading.value = false;
  }
});

async function saveSettings() {
  isLoading.value = true;
  try {
    const key = `sprint-history-settings-${props.groupId}`;
    await chrome.storage.local.set({[key]: toRaw(form)});
    showToast({severity: 'success', summary: 'Сохранено', life: 3000});
    emit('success', toRaw(form));
  } catch (e) {
    console.warn('[sprint-history] saveSettings failed:', e);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <form
    class="flex flex-col gap-4 w-[480px]"
    @submit.prevent="saveSettings"
  >
    <div class="grid grid-cols-2 gap-x-3 gap-y-3">
      <FormField label="Период по умолчанию">
        <Select
          v-model="form.defaultPeriod"
          :options="PERIOD_OPTIONS"
          option-label="label"
          option-value="value"
          size="small"
          class="w-full"
        />
      </FormField>
      <FormField label="Исполнитель по умолчанию">
        <Select
          v-model="form.defaultResponsibleId"
          :options="userOptions"
          option-label="name"
          option-value="id"
          placeholder="Все исполнители"
          show-clear
          :loading="isUsersLoading"
          size="small"
          class="w-full"
        >
          <template #option="{option}">
            <div class="flex gap-2 items-center">
              <Avatar
                v-if="option.photo"
                :image="option.photo"
                shape="circle"
                size="small"
              />
              {{ option.name }}
            </div>
          </template>
        </Select>
      </FormField>
      <FormField label="Колонки по умолчанию">
        <MultiSelect
          v-model="form.defaultStageIds"
          :options="stages"
          option-label="name"
          option-value="id"
          placeholder="Все колонки"
          filter
          filter-placeholder="Поиск"
          show-clear
          size="small"
          class="w-full"
        />
      </FormField>
      <FormField
        label="Статус корневой задачи"
        tip="Применяется только в режиме «Группировать по задаче» — фильтрует по тому, завершена ли сама корневая задача."
      >
        <Select
          v-model="form.defaultRootStatus"
          :options="ROOT_STATUS_OPTIONS"
          option-label="label"
          option-value="value"
          size="small"
          class="w-full"
        />
      </FormField>
      <div class="flex gap-2 items-center self-end">
        <ToggleSwitch
          v-model="form.defaultExcludeHotfixes"
          input-id="sprint-history-settings-exclude-hotfixes"
          size="small"
        />
        <label
          for="sprint-history-settings-exclude-hotfixes"
          class="text-sm cursor-pointer"
        >Исключать хотфиксы</label>
      </div>
      <div class="flex gap-2 items-center self-end">
        <ToggleSwitch
          v-model="form.defaultGroupByParent"
          input-id="sprint-history-settings-group-by-parent"
          size="small"
        />
        <label
          for="sprint-history-settings-group-by-parent"
          class="text-sm cursor-pointer"
        >Группировать по задаче</label>
      </div>
    </div>

    <Button
      size="small"
      type="submit"
      label="Сохранить"
      class="self-start"
      :loading="isLoading"
    />
  </form>
</template>
