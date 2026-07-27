<script setup>
import {Button} from 'primevue';
import {ref} from 'vue';

import {showToast} from '../../../toastHost/showToast.js';
import {downloadBlob, escapeCsvCell} from '../../../utils.js';

const props = defineProps({
  headers: {
    type: Array,
    required: true,
  },
  rows: {
    type: Array,
    required: true,
  },
  fileName: {
    type: String,
    default: 'task-dynamics.csv',
  },
  copySeparator: {
    type: String,
    default: '\t',
  },
  csvSeparator: {
    type: String,
    default: ',',
  },
});

const copied = ref(false);

async function copyToClipboard() {
  const text = [props.headers, ...props.rows].map((row) => row.join(props.copySeparator)).join('\n');

  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // Браузер отказывает в доступе к буферу, когда страница не в фокусе — молчать здесь нельзя,
    // иначе кнопка выглядит нажатой, а данных в буфере нет
    console.warn(e);
    showToast({
      severity: 'error',
      summary: 'Не удалось скопировать',
      detail: 'Браузер не дал доступ к буферу обмена. Выгрузите данные кнопкой «CSV».',
      life: 5000,
    });
    return;
  }

  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

function exportCsv() {
  const csv = [props.headers, ...props.rows]
    .map((row) => row.map(escapeCsvCell).join(props.csvSeparator))
    .join('\n');
  downloadBlob(new Blob([csv], {type: 'text/csv;charset=utf-8;'}), props.fileName);
}
</script>

<template>
  <div class="flex gap-1">
    <Button
      size="small"
      severity="secondary"
      variant="text"
      icon="pi pi-copy"
      :label="copied ? 'Скопировано' : 'Копировать'"
      :disabled="!rows.length"
      @click="copyToClipboard"
    />
    <Button
      size="small"
      severity="secondary"
      variant="text"
      icon="pi pi-download"
      label="CSV"
      :disabled="!rows.length"
      @click="exportCsv"
    />
  </div>
</template>
