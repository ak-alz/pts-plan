<script setup>
import VModal from '@/vue/ui/modal/VModal.vue';
import { inject, ref, watch } from 'vue';
import VCheckbox from '@/vue/ui/checkbox/VCheckbox.vue';
import VIcon from '@/vue/ui/icon/VIcon.vue';
import VInput from '@/vue/ui/input/VInput.vue';
import VSelect from '@/vue/ui/select/VSelect.vue';

defineProps({
  columns: {
    type: Array,
    default() {
      return [];
    },
  },
  users: {
    type: Array,
    default() {
      return [];
    },
  },
});

const groupId = inject('groupId');

const settings = defineModel({
  type: Object,
  required: true,
});

const isOpened = ref(false);

watch(() => settings.value, (newValue) => {
  if (isOpened.value) {
    window.localStorage.setItem(`scrum-points-settings-${groupId}`, JSON.stringify({
      ...newValue,
      date: new Date().getTime(),
    }));
  }
}, { deep: true });

const weekDays = [
  {
    value: '1',
    label: 'Пн.',
  },
  {
    value: '2',
    label: 'Вт.',
  },
  {
    value: '3',
    label: 'Ср.',
  },
  {
    value: '4',
    label: 'Чт.',
  },
  {
    value: '5',
    label: 'Пт.',
  },
  {
    value: '6',
    label: 'Сб.',
  },
  {
    value: '7',
    label: 'Вс.',
  },
];
</script>

<template>
  <div class="scrum-settings">
    <button
      class="scrum-settings__button"
      type="button"
      aria-label="Настройки"
      @click="isOpened = true"
    >
      <VIcon name="settings" />
    </button>
    <VModal v-model="isOpened">
      <div class="scrum-settings__blocks">
        <div class="scrum-settings__block --wide">
          <div class="scrum-settings__block-name">
            Общие настройки
          </div>
          <div class="scrum-settings__block-items">
            <div class="scrum-settings__input">
              <VInput
                v-model="settings.sprintNumber"
                type="number"
                min="1"
              />
              Номер спринта (далее будет изменяться автоматически)
            </div>
            <div class="scrum-settings__input">
              <VSelect v-model="settings.sprintFirstDate" :options="weekDays" />
              Первый день спринта
            </div>
            <VCheckbox
              v-model="settings.showSummary"
              label="Показывать строку итогов"
            />
            <VCheckbox
              v-if="settings.showSummary"
              v-model="settings.showCopyButton"
              label="Показывать кнопку копирования"
              style="padding-left: 30px;"
            />
            <VCheckbox
              v-model="settings.showTasksCount"
              label="Показывать количество задач"
            />
            <VCheckbox
              v-model="settings.showQuestion"
              label="Отмечать знаком «?» задачи без оценки"
            />
            <VCheckbox
              v-model="settings.showPlus"
              label="Отмечать знаком «+» задачи с неопределенной сложностью"
            />
            <VCheckbox
              v-model="settings.showDetails"
              label="Показывать детальный список задач"
            />
          </div>
        </div>
        <div class="scrum-settings__block">
          <div class="scrum-settings__block-name">
            Колонки
          </div>
          <div class="scrum-settings__block-items">
            <VCheckbox
              v-for="column in columns"
              :key="column.id"
              v-model="settings.columns[column.id]"
              :label="column.name"
            />
          </div>
        </div>
        <div class="scrum-settings__block">
          <div class="scrum-settings__block-name">
            Пользователи
          </div>
          <div class="scrum-settings__block-items">
            <VCheckbox
              v-for="user in users"
              :key="user.id"
              v-model="settings.users[user.id]"
              :label="user.name"
            />
          </div>
        </div>
      </div>
    </VModal>
  </div>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
