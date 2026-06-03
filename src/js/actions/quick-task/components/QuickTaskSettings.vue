<script setup>
import {Avatar, Button, Checkbox, MultiSelect, Select} from 'primevue';
import {useToast} from 'primevue/usetoast';
import {reactive, ref, toRaw} from 'vue';

import FormField from '../../../ui/FormField.vue';

const props = defineProps({
  initial: {type: Object, default: () => ({})},
  settingsStorageKey: {type: String, required: true},
  users: {type: Array, default: () => []},
  currentUserId: {type: Number, default: null},
});

const emit = defineEmits(['success']);

const toast = useToast();
const isLoading = ref(false);

const form = reactive({
  defaultResponsible: props.initial.defaultResponsible ?? props.currentUserId,
  defaultAuditors: props.initial.defaultAuditors ? toRaw(props.initial.defaultAuditors) : [],
  showCommitCheckbox: props.initial.showCommitCheckbox ?? false,
  copyCommitDefault: props.initial.copyCommitDefault ?? false,
  showCreatedTask: props.initial.showCreatedTask ?? false,
});

async function save() {
  isLoading.value = true;
  try {
    await chrome.storage.local.set({
      [props.settingsStorageKey]: {
        ...toRaw(form),
        defaultAuditors: [...form.defaultAuditors],
      },
    });
    toast.add({group: 'quick-task', severity: 'success', summary: 'Сохранено', life: 3000});
    emit('success');
  } catch {
    // ignore
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <form
    class="w-[500px]"
    @submit.prevent="save"
  >
    <div class="grid grid-cols-2 gap-x-4 gap-3 mb-3">
      <FormField
        id="qt_default_responsible"
        label="Исполнитель по умолчанию"
      >
        <Select
          v-model="form.defaultResponsible"
          option-value="id"
          option-label="title"
          :options="users"
          show-clear
          filter
          filter-placeholder="Поиск"
          fluid
          input-id="qt_default_responsible"
          placeholder="Не выбран"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Avatar
                v-if="option.avatar"
                :image="option.avatar"
                shape="circle"
                size="small"
              />
              {{ option.title }}
            </div>
          </template>
        </Select>
      </FormField>

      <FormField
        id="qt_default_auditors"
        label="Наблюдатели по умолчанию"
      >
        <MultiSelect
          v-model="form.defaultAuditors"
          option-value="id"
          option-label="title"
          :options="users"
          filter
          filter-placeholder="Поиск"
          :max-selected-labels="2"
          fluid
          input-id="qt_default_auditors"
          placeholder="Не выбраны"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Avatar
                v-if="option.avatar"
                :image="option.avatar"
                shape="circle"
                size="small"
              />
              {{ option.title }}
            </div>
          </template>
        </MultiSelect>
      </FormField>

      <div class="flex gap-2 items-center">
        <Checkbox
          v-model="form.showCommitCheckbox"
          binary
          input-id="qt_show_commit_checkbox"
          class="mt-0.5 shrink-0"
        />
        <label
          for="qt_show_commit_checkbox"
          class="text-sm cursor-pointer select-none"
        >Показывать «Копировать текст коммита»</label>
      </div>

      <div class="flex gap-2 items-center">
        <Checkbox
          v-model="form.copyCommitDefault"
          binary
          input-id="qt_copy_commit_default"
          class="mt-0.5 shrink-0"
        />
        <label
          for="qt_copy_commit_default"
          class="text-sm cursor-pointer select-none"
        >«Копировать текст коммита» по умолчанию</label>
      </div>

      <div class="flex gap-2 center">
        <Checkbox
          v-model="form.showCreatedTask"
          binary
          input-id="qt_show_created_task"
          class="mt-0.5 shrink-0"
        />
        <label
          for="qt_show_created_task"
          class="text-sm cursor-pointer select-none"
        >Показывать ссылку на созданную задачу</label>
      </div>
    </div>

    <Button
      type="submit"
      label="Сохранить"
      size="small"
      :loading="isLoading"
      class="col-span-2 justify-self-start"
    />
  </form>
</template>
