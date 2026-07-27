<script setup>
import {Tab, TabList, TabPanel, TabPanels, Tabs} from 'primevue';

import {TAB_OPTIONS} from '../variables.js';
import BacklogAgeChart from './BacklogAgeChart.vue';
import DecompositionChart from './DecompositionChart.vue';
import FlowChart from './FlowChart.vue';
import LeadTimeChart from './LeadTimeChart.vue';
import QualityChart from './QualityChart.vue';
import SummaryTable from './SummaryTable.vue';
import TeamChart from './TeamChart.vue';

defineProps({
  defaultTab: {type: String, default: 'summary'},
  summary: {type: Object, required: true},
  compareSummary: {type: Object, default: null},
  bucketRows: {type: Array, default: () => []},
  qualityRows: {type: Array, default: () => []},
  backlog: {type: Object, default: null},
  snapshotAt: {type: String, default: null},
  snapshotLoading: {type: Boolean, default: false},
  hasBacklogColumns: {type: Boolean, default: false},
  milestoneMarkers: {type: Array, default: () => []},
  milestoneComparison: {type: Object, default: null},
  milestones: {type: Array, default: () => []},
  userNames: {type: Object, default: () => ({})},
  groupId: {type: String, required: true},
  dateRange: {type: Array, default: null},
  compareDateRange: {type: Array, default: null},
  cut: {type: String, default: 'all'},
  valueMode: {type: String, default: 'absolute'},
  contributionThresholdPercent: {type: Number, default: 1},
  copySeparator: {type: String, default: '\t'},
  csvSeparator: {type: String, default: ','},
});

const emit = defineEmits(['open-settings']);
</script>

<template>
  <Tabs :value="defaultTab">
    <TabList>
      <Tab
        v-for="tab in TAB_OPTIONS"
        :key="tab.value"
        :value="tab.value"
      >
        {{ tab.label }}
      </Tab>
    </TabList>
    <TabPanels>
      <TabPanel value="summary">
        <SummaryTable
          :summary="summary"
          :compare-summary="compareSummary"
          :backlog="backlog"
          :snapshot-at="snapshotAt"
          :snapshot-loading="snapshotLoading"
          :milestone-comparison="milestoneComparison"
          :milestones="milestones"
          :bucket-rows="bucketRows"
          :group-id="groupId"
          :date-range="dateRange"
          :compare-date-range="compareDateRange"
          :cut="cut"
          :copy-separator="copySeparator"
          :csv-separator="csvSeparator"
        />
      </TabPanel>

      <TabPanel value="flow">
        <FlowChart
          :rows="bucketRows"
          :milestones="milestoneMarkers"
          :backlog-total="backlog ? backlog.backlog.total : null"
          :copy-separator="copySeparator"
          :csv-separator="csvSeparator"
        />
      </TabPanel>

      <TabPanel value="leadTime">
        <LeadTimeChart
          :rows="bucketRows"
          :milestones="milestoneMarkers"
          :copy-separator="copySeparator"
          :csv-separator="csvSeparator"
        />
        <div class="mt-6 pt-4 border-t border-surface-200 dark:border-surface-700">
          <BacklogAgeChart
            :snapshot="backlog"
            :snapshot-at="snapshotAt"
            :snapshot-loading="snapshotLoading"
            :has-backlog-columns="hasBacklogColumns"
            :value-mode="valueMode"
            :copy-separator="copySeparator"
            :csv-separator="csvSeparator"
            @open-settings="emit('open-settings')"
          />
        </div>
      </TabPanel>

      <TabPanel value="team">
        <TeamChart
          :rows="bucketRows"
          :team="summary.team"
          :user-names="userNames"
          :contribution-threshold-percent="contributionThresholdPercent"
          :milestones="milestoneMarkers"
          :copy-separator="copySeparator"
          :csv-separator="csvSeparator"
        />
      </TabPanel>

      <TabPanel value="quality">
        <QualityChart
          :rows="qualityRows"
          :milestones="milestoneMarkers"
          :copy-separator="copySeparator"
          :csv-separator="csvSeparator"
        />
      </TabPanel>

      <TabPanel value="decomposition">
        <DecompositionChart
          :rows="bucketRows"
          :milestones="milestoneMarkers"
          :value-mode="valueMode"
          :copy-separator="copySeparator"
          :csv-separator="csvSeparator"
        />
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>
