<script setup>
import { Button, InputNumber, MultiSelect } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { reactive, ref, toRaw } from 'vue';

import FormField from '../../../ui/FormField.vue';
import { defaultIgnorePoints, defaultMaxSprints } from '../variables.js';

const props = defineProps({
  users: {
    type: Array,
    default() {
      return [];
    },
  },
  sprints: {
    type: Array,
    default() {
      return [];
    },
  },
  initial: {
    type: Object,
    default() {
      return {};
    },
  },
  settingsStorageKey: {
    type: String,
    required: true,
  },
  simple: {
    type: Boolean,
    default: false,
  },
});

const emits = defineEmits(['success']);

const toast = useToast();

const isLoading = ref(false);

const form = reactive({
  users: props.initial.users ? toRaw(props.initial.users) : [],
  taskId: props.initial.taskId ? toRaw(props.initial.taskId) : null,
  maxSprintsCount: props.initial.maxSprintsCount ? toRaw(props.initial.maxSprintsCount) : defaultMaxSprints,
  ignorePoints: props.initial.ignorePoints ? toRaw(props.initial.ignorePoints) : defaultIgnorePoints,
});

async function saveSettings() {
  isLoading.value = true;

  try {
    await chrome.storage.local.set({
      [props.settingsStorageKey]: toRaw(form),
    });

    toast.add({
      severity: 'success',
      summary: 'Сохранено',
      detail: 'Настройки успешно сохранены.',
      life: 5000,
    });

    emits('success');
  } catch (e) {
    console.warn(e);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <form
    class="flex flex-col gap-3"
    style="width: 400px;"
    @submit.prevent="saveSettings"
  >
    <FormField
      id="settings_task_id"
      label="ID задачи"
      tip="ID задачи, в комментариях которой есть информация об итогах прошедших спринтов. Структура таких комментариев должна соответсовать определенному формату."
    >
      <InputNumber
        v-model="form.taskId"
        :max-fraction-digits="0"
        :use-grouping="false"
        fluid
        input-id="settings_task_id"
      />
    </FormField>

    <template v-if="!simple">
      <FormField
        id="settings_users"
        label="Исполнители"
      >
        <MultiSelect
          v-model="form.users"
          option-value="id"
          option-label="name"
          :options="users"
          filter
          filter-placeholder="Поиск"
          fluid
          input-id="settings_users"
          :max-selected-labels="3"
        />
      </FormField>

      <FormField
        id="settings_max_sprints_count"
        label="Количество выводимых спринтов"
        tip="Количество спринтов с конца, на основе которых рассчитываются показатели"
      >
        <InputNumber
          v-model="form.maxSprintsCount"
          :max-fraction-digits="0"
          :use-grouping="false"
          fluid
          :min="0"
          :max="Math.max(sprints.length, defaultMaxSprints)"
          input-id="settings_max_sprints_count"
        />
      </FormField>

      <FormField
        id="settings_ignore_points"
        label="Граница игнорирования баллов"
        tip="Игнорировать баллы исполнителей, если они ниже заданного числа (отпуск, короткая неделя)"
      >
        <InputNumber
          v-model="form.ignorePoints"
          :max-fraction-digits="0"
          :use-grouping="false"
          fluid
          :min="0"
          input-id="settings_ignore_points"
        />
      </FormField>
    </template>

    <Button
      size="small"
      type="submit"
      label="Сохранить"
      fluid
      :loading="isLoading"
    />
  </form>
</template>

<style scoped>

</style>
