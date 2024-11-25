<script setup>
import { watch } from 'vue';
import VModal from '@/vue/ui/modal/VModal.vue';
import VCheckbox from '@/vue/ui/checkbox/VCheckbox.vue';
import VIcon from '@/vue/ui/icon/VIcon.vue';

const isOpened = defineModel('showModal', {
  type: Boolean,
  required: true,
});

const dontShow = defineModel('dontShow', {
  type: Boolean,
  required: true,
});

watch(dontShow, (newValue) => {
  if (newValue) {
    window.localStorage.setItem('dontShow', true);
  } else {
    window.localStorage.removeItem('dontShow');
  }
});
</script>

<template>
  <VModal v-model="isOpened">
    <div class="success-modal">
      <div class="success-modal__icon">
        <VIcon name="checkbox" />
      </div>
      <div class="success-modal__title">
        Настройки успешно сохранены
      </div>
      <div class="success-modal__description">
        Необходимо перезагрузить страницу, чтобы применить настройки
      </div>
      <VCheckbox
        v-model="dontShow"
        label="Больше не показывать"
      />
    </div>
  </VModal>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
