<script setup>
import { Badge, Button, Checkbox, Select } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { reactive, ref, toRaw } from 'vue';

import FormField from '../../../ui/FormField.vue';

const props = defineProps({
  stages: {
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
});

const emits = defineEmits(['success']);

const toast = useToast();
const isLoading = ref(false);

const form = reactive({
  defaultStageId: props.initial.defaultStageId ?? null,
  allAuditorsDefault: props.initial.allAuditorsDefault ?? false,
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
    style="width: 320px;"
    @submit.prevent="saveSettings"
  >
    <FormField
      id="dt_default_stage"
      label="Стадия по умолчанию"
      tip="Будет автоматически выбрана при добавлении новой строки"
    >
      <Select
        v-model="form.defaultStageId"
        option-value="id"
        option-label="title"
        :options="stages"
        show-clear
        fluid
        input-id="dt_default_stage"
        placeholder="Не выбрана"
      >
        <template #option="{ option }">
          <div class="flex gap-2 items-center">
            <Badge :style="`background-color: ${option.color};`" />
            {{ option.title }}
          </div>
        </template>
      </Select>
    </FormField>

    <div class="flex gap-1 items-center">
      <Checkbox
        v-model="form.allAuditorsDefault"
        binary
        input-id="dt_all_auditors_default"
      />
      <label for="dt_all_auditors_default">Все участники группы как наблюдатели</label>
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
