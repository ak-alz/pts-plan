<script setup>
import { Badge, Column, ColumnGroup, DataTable, Row } from 'primevue';

defineProps({
  users: {
    type: Array,
    default() {
      return [];
    },
  },
  team: {
    type: Object,
    default: null,
  },
  trendMode: {
    type: Boolean,
    default: false,
  },
});

// Пояснение общее для тренда и обеих дельт: колонка тренда видна не всегда, а дельты — всегда
const FULL_TEAM_TIP = 'Приведено к полному составу: сумма спринта делится на средний балл тех, кто в нём участвовал, и умножается на средний балл всей команды. Иначе спринт с отпусками занижал бы показатель — из личного тренда отсутствия выпадают, а из суммы команды нет';

</script>

<template>
  <DataTable
    :value="users"
    data-key="id"
    size="small"
    striped-rows
    sort-field="median"
    :sort-order="-1"
    :default-sort-order="-1"
  >
    <Column
      field="name"
      header="Исполнитель"
    >
      <template #body="{data}">
        <a
          target="_top"
          :href="data.url"
        >
          <Badge :style="`background-color: ${data.color};`" />
          {{ data.name }}
        </a>
      </template>
    </Column>
    <Column>
      <template #header>
        <b>Спринтов</b>
        <i
          v-tooltip="'Для расчётов/Отфильтрованные/Все'"
          class="pi pi-question-circle"
        />
      </template>
      <template #body="{data}">
        {{ data.visibleSprints.length }}/{{ data.filteredSprintsLength }}/{{ data.sprints.length }}
      </template>
    </Column>
    <Column
      field="avg"
      header="Средний балл"
      sortable
    >
      <template #body="{data}">
        {{ data.avg }}
        <span
          v-if="data.deltaAvg"
          class="text-sm"
          :class="{
            'text-green-400': data.deltaAvg > 0,
            'text-red-400': data.deltaAvg < 0,
          }"
        >
          <template v-if="data.deltaAvg > 0">+</template>{{ data.deltaAvg }}
        </span>
      </template>
    </Column>
    <Column
      field="median"
      header="Медианный балл"
      sortable
    >
      <template #body="{data}">
        {{ data.median }}
        <span
          v-if="data.deltaMedian"
          class="text-sm"
          :class="{
            'text-green-400': data.deltaMedian > 0,
            'text-red-400': data.deltaMedian < 0,
            'text-surface-400 dark:text-surface-500': data.deltaMedian === 0,
          }"
        >
          <template v-if="data.deltaMedian > 0">+</template>{{ data.deltaMedian }}
        </span>
      </template>
    </Column>

    <Column
      v-if="trendMode"
      field="trendPct"
      header="Тренд"
      sortable
    >
      <template #body="{data}">
        <template v-if="data.trendDelta !== null">
          <span class="text-surface-400 dark:text-surface-500">{{ data.trendStart }} → {{ data.trendEnd }}</span>
          <span
            class="ml-1 text-sm"
            :class="{
              'text-green-400': data.trendDelta > 0,
              'text-red-400': data.trendDelta < 0,
              'text-surface-400 dark:text-surface-500': data.trendDelta === 0,
            }"
          >
            <template v-if="data.trendDelta > 0">+</template>{{ data.trendDelta }}
            (<template v-if="data.trendPct > 0">+</template>{{ data.trendPct }}%)
          </span>
        </template>
        <span
          v-else
          class="text-surface-400 dark:text-surface-500"
        >—</span>
      </template>
    </Column>

    <ColumnGroup type="footer">
      <Row v-if="team">
        <Column>
          <template #footer>
            <i class="pi pi-users mr-1" />
            <b>Вся команда</b>
            <i
              v-tooltip="'Баллы всех исполнителей за спринт складываются, и уже эти суммы усредняются по спринтам периода. Личные средние не усредняются: в спринтах разный состав'"
              class="pi pi-question-circle ml-1"
            />
          </template>
        </Column>
        <Column>
          <template #footer>
            <span v-tooltip="`В среднем ${team.avgParticipants} исполнителей в спринте`">{{ team.sprintsCount }}</span>
          </template>
        </Column>
        <Column>
          <template #footer>
            {{ team.avg }}
            <span
              v-if="team.deltaAvg"
              v-tooltip="FULL_TEAM_TIP"
              class="text-sm font-normal"
              :class="{
                'text-green-400': team.deltaAvg > 0,
                'text-red-400': team.deltaAvg < 0,
              }"
            >
              <template v-if="team.deltaAvg > 0">+</template>{{ team.deltaAvg }}
            </span>
            <span
              v-tooltip="'Все баллы за период, делённые на число участий в спринтах'"
              class="block w-fit text-xs font-normal text-surface-400 dark:text-surface-500"
            >
              ≈ {{ team.avgPerParticipant }} на исполнителя
            </span>
          </template>
        </Column>
        <Column>
          <template #footer>
            {{ team.median }}
            <span
              v-if="team.deltaMedian"
              v-tooltip="FULL_TEAM_TIP"
              class="text-sm font-normal"
              :class="{
                'text-green-400': team.deltaMedian > 0,
                'text-red-400': team.deltaMedian < 0,
              }"
            >
              <template v-if="team.deltaMedian > 0">+</template>{{ team.deltaMedian }}
            </span>
            <span
              v-tooltip="'Сумма баллов всех исполнителей за все спринты периода'"
              class="block w-fit text-xs font-normal text-surface-400 dark:text-surface-500"
            >
              {{ team.totalPoints }} всего за период
            </span>
          </template>
        </Column>
        <Column v-if="trendMode">
          <template #footer>
            <template v-if="team.trendDelta !== null">
              <span class="text-surface-400 dark:text-surface-500 font-normal">{{ team.trendStart }} → {{ team.trendEnd }}</span>
              <span
                class="ml-1 text-sm font-normal"
                :class="{
                  'text-green-400': team.trendDelta > 0,
                  'text-red-400': team.trendDelta < 0,
                  'text-surface-400 dark:text-surface-500': team.trendDelta === 0,
                }"
              >
                <template v-if="team.trendDelta > 0">+</template>{{ team.trendDelta }}
                (<template v-if="team.trendPct > 0">+</template>{{ team.trendPct }}%)
              </span>
              <span class="block text-xs font-normal text-surface-400 dark:text-surface-500">
                при полном составе
                <i
                  v-tooltip="FULL_TEAM_TIP"
                  class="pi pi-question-circle"
                />
              </span>
            </template>
            <span
              v-else
              class="text-surface-400 dark:text-surface-500 font-normal"
            >—</span>
          </template>
        </Column>
      </Row>
    </ColumnGroup>

    <template #empty>
      Нет данных
    </template>
  </DataTable>
</template>
