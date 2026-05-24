<script setup>
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primevue';

import TaskChart from './TaskChart.vue';
import TaskHistogram from './TaskHistogram.vue';
import TaskRootTable from './TaskRootTable.vue';
import TaskSummaryTable from './TaskSummaryTable.vue';
import TaskTopList from './TaskTopList.vue';

defineProps({
  timelineChartData: {type: Object, default: null},
  allUserTasksPerUser: {type: Array, default: () => []},
  users: {type: Array, default: () => []},
  summaryTableData: {type: Object, default: null},
  topTasksData: {type: Object, default: null},
  allRows: {type: Array, default: () => []},
  isLoading: {type: Boolean, default: false},
  multiUser: {type: Boolean, default: false},
  copySeparator: {type: String, default: '\t'},
  csvSeparator: {type: String, default: ','},
  defaultTab: {type: String, default: 'summary'},
  groupId: {type: String, required: true},
  dateRange: {type: Array, default: null},
});
</script>

<template>
  <Tabs :value="defaultTab">
    <TabList>
      <Tab value="summary">
        Сводка
      </Tab>
      <Tab value="timeline">
        Динамика
      </Tab>
      <Tab value="top">
        Топ задач
      </Tab>
      <Tab value="tasks">
        Задачи
      </Tab>
      <Tab value="histogram">
        Размеры задач
      </Tab>
    </TabList>
    <TabPanels>
      <TabPanel value="summary">
        <TaskSummaryTable
          v-if="summaryTableData"
          :rows="summaryTableData.rows"
          :group-id="groupId"
          :date-range="dateRange"
          :multi-user="multiUser"
          :copy-separator="copySeparator"
          :csv-separator="csvSeparator"
        />
      </TabPanel>
      <TabPanel value="timeline">
        <TaskChart
          v-if="timelineChartData"
          :chart-data="timelineChartData"
        />
      </TabPanel>
      <TabPanel value="top">
        <TaskTopList
          v-if="topTasksData"
          :rows="topTasksData.rows"
          :multi-user="multiUser"
        />
      </TabPanel>
      <TabPanel value="tasks">
        <TaskRootTable
          :rows="allRows"
          :is-loading="isLoading"
          :multi-user="multiUser"
        />
      </TabPanel>
      <TabPanel value="histogram">
        <TaskHistogram
          v-if="allUserTasksPerUser.length"
          :all-user-tasks-per-user="allUserTasksPerUser"
          :users="users"
        />
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>
