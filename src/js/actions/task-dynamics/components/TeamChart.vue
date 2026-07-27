<script setup>
import {Column, DataTable, Panel, Tag} from 'primevue';
import {computed} from 'vue';

import {pluralize} from '../../../utils.js';
import {barDataset, lineDataset} from '../chartDatasets.js';
import {CHART_COLORS} from '../variables.js';
import DynamicsChart from './DynamicsChart.vue';
import ExportButtons from './ExportButtons.vue';

const props = defineProps({
  rows: {
    type: Array,
    required: true,
  },
  team: {
    type: Object,
    default: null,
  },
  userNames: {
    type: Object,
    default: () => ({}),
  },
  contributionThresholdPercent: {
    type: Number,
    default: 1,
  },
  milestones: {
    type: Array,
    default: () => [],
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

const chartData = computed(() => ({
  labels: props.rows.map((row) => row.label),
  datasets: [
    barDataset({label: 'Баллы', data: props.rows.map((row) => row.points), color: CHART_COLORS.points}),
    lineDataset({
      label: 'Активных исполнителей',
      data: props.rows.map((row) => row.activeUsers),
      color: CHART_COLORS.people,
      pointStyle: 'rectRot',
    }),
    lineDataset({
      label: 'Баллов на человека',
      data: props.rows.map((row) => row.pointsPerActiveUser),
      color: CHART_COLORS.pointsPerPerson,
      yAxisID: 'y',
      dash: [6, 4],
    }),
  ],
}));

const exportHeaders = ['Бакет', 'Баллы', 'Закрыто задач', 'Активных исполнителей', 'Баллов на человека'];
const exportRows = computed(() => props.rows.map((row) => [
  row.label,
  row.points,
  row.closed,
  row.activeUsers,
  row.pointsPerActiveUser,
]));

const userRows = computed(() => (props.team?.all ?? []).map((entry) => ({
  ...entry,
  userName: props.userNames[entry.userId] ?? `ID ${entry.userId}`,
})));

const othersNote = computed(() => {
  const others = props.team?.others;
  if (!others?.count) return '';
  return `Прочие исполнители: ${others.count} ${pluralize(others.count, ['человек', 'человека', 'человек'])}, `
    + `${others.closed} ${pluralize(others.closed, ['задача', 'задачи', 'задач'])}, ${others.points} `
    + `${pluralize(others.points, ['балл', 'балла', 'баллов'])} — в состав команды не входят, но в «Поток» и «Баллы» попадают.`;
});
</script>

<template>
  <DynamicsChart
    :chart-data="chartData"
    :milestones="milestones"
    y-title="Баллы"
    y1-title="Человек"
  >
    <template #actions>
      <ExportButtons
        :headers="exportHeaders"
        :rows="exportRows"
        file-name="task-dynamics-team.csv"
        :copy-separator="copySeparator"
        :csv-separator="csvSeparator"
      />
    </template>
  </DynamicsChart>
  <p class="text-xs text-surface-500 dark:text-surface-400 mt-2">
    Столбцы — все баллы периода, линия «Баллов на человека» — только баллы состава команды, поделённые на
    число активных в бакете. Состав определяется по всему периоду
    <template v-if="contributionThresholdPercent > 0">
      (порог вклада — {{ contributionThresholdPercent }}% баллов периода, то есть от
      {{ team?.thresholdPoints ?? 0 }} баллов)
    </template>
    <template v-else>
      (порог вклада отключён — учитываются все исполнители)
    </template>,
    активность — по бакету: отпуск или болезнь не выкидывают человека из состава задним числом.
    {{ othersNote }}
  </p>

  <Panel
    v-if="userRows.length"
    header="Исполнители периода"
    toggleable
    collapsed
    class="mt-3"
  >
    <DataTable
      :value="userRows"
      data-key="userId"
      size="small"
      striped-rows
      show-gridlines
      paginator
      :rows="15"
      :rows-per-page-options="[15, 30, 50, 100]"
      :always-show-paginator="false"
      sort-field="points"
      :sort-order="-1"
    >
      <Column
        field="userName"
        header="Исполнитель"
        sortable
      >
        <template #body="{data}">
          <span class="pts-blur">{{ data.userName }}</span>
        </template>
      </Column>
      <Column
        field="points"
        header="Баллы"
        sortable
      />
      <Column
        field="closed"
        header="Закрыто задач"
        sortable
      />
      <Column
        field="pointsShare"
        header="Доля баллов"
        sortable
      >
        <template #body="{data}">
          {{ data.pointsShare }}%
        </template>
      </Column>
      <Column header="Учитывается">
        <template #body="{data}">
          <Tag
            v-if="data.isExcluded"
            severity="secondary"
            value="Исключён вручную"
          />
          <Tag
            v-else-if="data.isMember"
            severity="success"
            value="В составе"
          />
          <Tag
            v-else
            severity="warn"
            value="Ниже порога вклада"
          />
        </template>
      </Column>

      <template #empty>
        Нет данных
      </template>
    </DataTable>
  </Panel>
</template>
