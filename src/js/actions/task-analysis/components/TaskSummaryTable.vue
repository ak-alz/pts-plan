<script setup>
import {Button, Column, DataTable} from 'primevue';
import {computed, ref} from 'vue';

import {colors} from '../../../utils.js';

const props = defineProps({
  rows: {
    type: Array,
    required: true,
  },
  multiUser: {
    type: Boolean,
    default: false,
  },
  useWeeks: {
    type: Boolean,
    default: false,
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

const indigoShades = Object.values(colors.indigo);

const pointColorMap = computed(() => {
  const allPoints = [...new Set(
    props.rows.flatMap((row) => row.pointDistribution.map((s) => s.points)),
  )].sort((a, b) => a - b);
  return new Map(allPoints.map((p, i) => [p, indigoShades[i % indigoShades.length]]));
});

function getPointColor(points) {
  return pointColorMap.value.get(points);
}

function buildDistTooltip(dist) {
  return {
    value: dist.map((s) => `${s.points}: ${s.count} (${s.pct}%)`).join('\n'),
    pt: {text: {style: {whiteSpace: 'pre'}}},
  };
}

function buildRows() {
  const headers = [];
  if (props.multiUser) headers.push('Исполнитель');
  headers.push('Баллов всего', 'Задач всего', 'Корневые', 'Коэф. декомп.', 'Средний балл / задачу');
  headers.push(`Средний балл / ${props.useWeeks ? 'нед.' : 'мес.'}`);
  if (!props.useWeeks) headers.push('Средний балл / нед.');
  headers.push('Распределение');

  const dataRows = props.rows.map((row) => {
    const cells = [];
    if (props.multiUser) cells.push(row.userName);
    cells.push(row.totalPoints, row.totalTasks, row.totalRoots, row.decompRatio, row.avgPointsPerTask, row.avgPoints);
    if (!props.useWeeks) cells.push(row.avgPointsPerWeek);
    cells.push(row.pointDistribution.map((s) => `${s.points}: ${s.count} (${s.pct}%)`).join(', '));
    return cells;
  });

  return {headers, dataRows};
}

const copied = ref(false);

async function copyToClipboard() {
  const {headers, dataRows} = buildRows();
  const text = [headers, ...dataRows].map((row) => row.join(props.copySeparator)).join('\n');
  await navigator.clipboard.writeText(text);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

function exportCsv() {
  const {headers, dataRows} = buildRows();
  const csv = [headers, ...dataRows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(props.csvSeparator))
    .join('\n');
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'task-summary.csv';
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="flex gap-1 justify-end mb-2">
    <Button
      size="small"
      severity="secondary"
      variant="text"
      icon="pi pi-copy"
      :label="copied ? 'Скопировано' : 'Копировать'"
      @click="copyToClipboard"
    />
    <Button
      size="small"
      severity="secondary"
      variant="text"
      icon="pi pi-download"
      label="CSV"
      @click="exportCsv"
    />
  </div>
  <DataTable
    :value="rows"
    data-key="userId"
    sort-field="totalPoints"
    :sort-order="-1"
    :default-sort-order="-1"
    size="small"
  >
    <Column
      v-if="multiUser"
      field="userName"
      header="Исполнитель"
      :sortable="rows.length > 1"
    />
    <Column
      field="totalPoints"
      header="Баллов всего"
      :sortable="rows.length > 1"
    >
      <template #body="{ data }">
        {{ data.totalPoints }}
        <span
          v-if="data.deltaTotal !== null"
          class="text-sm"
          :class="{'text-green-400': data.deltaTotal > 0, 'text-red-400': data.deltaTotal < 0, 'text-surface-400': data.deltaTotal === 0}"
        ><template v-if="data.deltaTotal > 0">+</template>{{ data.deltaTotal }}</span>
      </template>
    </Column>
    <Column
      field="totalTasks"
      header="Задач всего"
      :sortable="rows.length > 1"
    >
      <template #body="{ data }">
        {{ data.totalTasks }}
        <span
          v-if="data.deltaTotalTasks !== null"
          class="text-sm"
          :class="{'text-green-400': data.deltaTotalTasks > 0, 'text-red-400': data.deltaTotalTasks < 0, 'text-surface-400': data.deltaTotalTasks === 0}"
        ><template v-if="data.deltaTotalTasks > 0">+</template>{{ data.deltaTotalTasks }}</span>
      </template>
    </Column>
    <Column
      field="totalRoots"
      header="Корневые"
      :sortable="rows.length > 1"
    >
      <template #body="{ data }">
        {{ data.totalRoots }}
        <span
          v-if="data.deltaTotalRoots !== null"
          class="text-sm"
          :class="{'text-green-400': data.deltaTotalRoots > 0, 'text-red-400': data.deltaTotalRoots < 0, 'text-surface-400': data.deltaTotalRoots === 0}"
        ><template v-if="data.deltaTotalRoots > 0">+</template>{{ data.deltaTotalRoots }}</span>
      </template>
    </Column>
    <Column
      field="decompRatio"
      :sortable="rows.length > 1"
    >
      <template #header>
        <b v-tooltip.top="'Отношение декомпозированных задач к корневым.\nПоказывает, сколько в среднем задач приходится на одну корневую.'">Коэф. декомп.</b>
      </template>
      <template #body="{ data }">
        {{ data.decompRatio }}
        <span
          v-if="data.deltaDecompRatio !== null"
          class="text-sm"
          :class="{'text-green-400': data.deltaDecompRatio > 0, 'text-red-400': data.deltaDecompRatio < 0, 'text-surface-400': data.deltaDecompRatio === 0}"
        ><template v-if="data.deltaDecompRatio > 0">+</template>{{ data.deltaDecompRatio }}</span>
      </template>
    </Column>
    <Column
      field="avgPointsPerTask"
      header="Средний балл / задачу"
      :sortable="rows.length > 1"
    >
      <template #body="{ data }">
        {{ data.avgPointsPerTask }}
        <span
          v-if="data.deltaAvgPointsPerTask !== null"
          class="text-sm"
          :class="{'text-green-400': data.deltaAvgPointsPerTask > 0, 'text-red-400': data.deltaAvgPointsPerTask < 0, 'text-surface-400': data.deltaAvgPointsPerTask === 0}"
        ><template v-if="data.deltaAvgPointsPerTask > 0">+</template>{{ data.deltaAvgPointsPerTask }}</span>
      </template>
    </Column>
    <Column
      field="avgPoints"
      :header="`Средний балл / ${useWeeks ? 'нед.' : 'мес.'}`"
      :sortable="rows.length > 1"
    >
      <template #body="{ data }">
        {{ data.avgPoints }}
        <span
          v-if="data.deltaAvgPoints !== null"
          class="text-sm"
          :class="{'text-green-400': data.deltaAvgPoints > 0, 'text-red-400': data.deltaAvgPoints < 0, 'text-surface-400': data.deltaAvgPoints === 0}"
        ><template v-if="data.deltaAvgPoints > 0">+</template>{{ data.deltaAvgPoints }}</span>
      </template>
    </Column>
    <Column
      v-if="!useWeeks"
      field="avgPointsPerWeek"
      header="Средний балл / нед."
      :sortable="rows.length > 1"
    >
      <template #body="{ data }">
        {{ data.avgPointsPerWeek }}
        <span
          v-if="data.deltaAvgPointsPerWeek !== null"
          class="text-sm"
          :class="{'text-green-400': data.deltaAvgPointsPerWeek > 0, 'text-red-400': data.deltaAvgPointsPerWeek < 0, 'text-surface-400': data.deltaAvgPointsPerWeek === 0}"
        ><template v-if="data.deltaAvgPointsPerWeek > 0">+</template>{{ data.deltaAvgPointsPerWeek }}</span>
      </template>
    </Column>
    <Column
      field="pointDistribution"
      header="Распределение"
    >
      <template #body="{ data }">
        <div
          v-tooltip="buildDistTooltip(data.pointDistribution)"
          class="flex h-4 rounded overflow-hidden min-w-25 gap-px"
        >
          <div
            v-for="seg in data.pointDistribution"
            :key="seg.points"
            :style="{
              width: seg.pct + '%',
              minWidth: '3px',
              backgroundColor: getPointColor(seg.points),
            }"
          />
        </div>
      </template>
    </Column>
  </DataTable>
</template>
