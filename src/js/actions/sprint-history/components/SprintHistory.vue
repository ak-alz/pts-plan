<script setup>
import dayjs from 'dayjs';
import { Avatar, Button, Column, ColumnGroup, DataTable, DatePicker, Row, Select } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import FormField from '../../../ui/FormField.vue';
import { getTaskPointsFromName, getTaskUrl } from '../../../utils.js';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  groupId: {
    type: String,
    required: true,
  },
});

const toast = useToast();
const bitrixApi = new BitrixApi(props.sessionId);

function getPrevWeekRange() {
  const today = dayjs();
  const dow = today.day(); // 0=Sun, 1=Mon … 6=Sat
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const thisMonday = today.subtract(daysSinceMonday, 'day').startOf('day');
  return [
    thisMonday.subtract(7, 'day').toDate(),
    thisMonday.subtract(1, 'day').toDate(),
  ];
}

const dateRange = ref(getPrevWeekRange());
const selectedUserId = ref(null);
const isLoading = ref(false);
const allTasks = ref([]);

const users = computed(() => {
  const map = {};
  allTasks.value.forEach((t) => {
    if (!map[t.responsible.id]) {
      map[t.responsible.id] = {
        id: t.responsible.id,
        name: t.responsible.name,
        photo: t.responsible.icon || null,
      };
    }
  });
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
});

const filteredTasks = computed(() => {
  if (!selectedUserId.value) return allTasks.value;
  return allTasks.value.filter((t) => t.responsible.id === selectedUserId.value);
});

const totalPoints = computed(() => filteredTasks.value.reduce((sum, t) => sum + t.points, 0));

async function fetchData() {
  if (!dateRange.value?.[0]) return;

  isLoading.value = true;
  selectedUserId.value = null;

  try {
    const dateFrom = dayjs(dateRange.value[0]).format('YYYY-MM-DD 00:00:00');
    const dateTo = dayjs(dateRange.value[1] ?? dateRange.value[0]).format('YYYY-MM-DD 23:59:59');
    const tasks = await bitrixApi.getClosedTasks(props.groupId, dateFrom, dateTo);

    allTasks.value = tasks.map((t) => ({
      ...t,
      points: getTaskPointsFromName(t.title),
    }));
  } catch (e) {
    console.warn(e);
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: `[pts-plan]: ${e.message}`,
      life: 5000,
    });
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div style="min-width: 640px;">
    <div class="flex gap-3 mb-4 items-end flex-wrap">
      <FormField label="Период">
        <DatePicker
          v-model="dateRange"
          selection-mode="range"
          date-format="dd.mm.yy"
          :manual-input="false"
          show-button-bar
          size="small"
        />
      </FormField>
      <FormField label="Исполнитель">
        <Select
          v-model="selectedUserId"
          :options="users"
          option-label="name"
          option-value="id"
          placeholder="Все"
          show-clear
          :disabled="!allTasks.length"
          style="min-width: 180px;"
          size="small"
        >
          <template #option="{ option }">
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
      <Button
        label="Загрузить"
        :loading="isLoading"
        icon="pi pi-search"
        size="small"
        @click="fetchData"
      />
    </div>

    <DataTable
      :value="filteredTasks"
      :loading="isLoading"
      data-key="id"
      sort-field="points"
      :sort-order="-1"
      :default-sort-order="-1"
      size="small"
    >
      <Column
        field="responsible.name"
        header="Исполнитель"
        sortable
      >
        <template #body="{ data }">
          <a
            :href="data.responsible.link"
            target="_top"
          >
            {{ data.responsible.name }}
          </a>
        </template>
      </Column>
      <Column header="Задача">
        <template #body="{ data }">
          <a
            :href="getTaskUrl(groupId, data.id)"
            target="_top"
          >
            {{ data.title }}
          </a>
        </template>
      </Column>
      <Column
        field="points"
        header="Баллы"
        sortable
      >
        <template #body="{ data }">
          {{ data.points }}
        </template>
      </Column>
      <Column
        field="closedDate"
        header="Закрыта"
        sortable
      >
        <template #body="{ data }">
          {{ dayjs(data.closedDate).format('DD.MM.YYYY') }}
        </template>
      </Column>

      <ColumnGroup type="footer">
        <Row>
          <Column
            colspan="2"
            footer="Итого:"
            footer-style="text-align: right;"
          />
          <Column :footer="totalPoints" />
          <Column />
        </Row>
      </ColumnGroup>

      <template #empty>
        Нет завершённых задач за выбранный период
      </template>
    </DataTable>
  </div>
</template>
