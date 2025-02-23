<script setup>
import VModal from '@/vue/ui/modal/VModal.vue';
import { inject, ref, watch } from 'vue';
import VCheckbox from '@/vue/ui/checkbox/VCheckbox.vue';
import VIcon from '@/vue/ui/icon/VIcon.vue';
import VInput from '@/vue/ui/input/VInput.vue';

defineProps({
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
    window.localStorage.setItem(`scrum-summary-settings-${groupId}`, JSON.stringify({
      ...newValue,
    }));
  }
}, { deep: true });
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
                v-model="settings.taskId"
                type="number"
                min="1"
              />
              ID задачи с итогами спринтов
            </div>
            <div class="scrum-settings__input">
              <VInput
                v-model="settings.sprintsCount"
                type="number"
                min="1"
              />
              Количество выводимых спринтов в графике
            </div>
            <VCheckbox
              v-model="settings.skipVacation"
              label="Игнорировать отпуск (0 заменять на предыдущие баллы)"
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
