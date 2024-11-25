<script setup>
import { ref } from 'vue';
import VModal from '@/vue/ui/modal/VModal.vue';
import VTip from '@/vue/ui/tip/VTip.vue';
import VIcon from '@/vue/ui/icon/VIcon.vue';

const isOpened = ref(false);
</script>

<template>
  <VTip @click="isOpened = true" />
  <VModal v-model="isOpened">
    <div class="info-modal">
      <div class="info-modal__title">
        О расширении
      </div>
      <div class="info-modal__row">
        Это обновлённая версия расширения
        <a
          href="https://chromewebstore.google.com/detail/planpixelplusru-injection/mhfnfibgbpoejngckfodcahflmgalkgc"
          target="_blank"
        >plan.pixelplus.ru Injection</a>
        (делал Алексей Каракчеев).
      </div>
      <div class="info-modal__row">
        Предложения по улучшению функционала приветствуются. Пишите в Plan
        <a
          href="https://plan.pixelplus.ru/company/personal/user/4594/"
          target="_blank"
        >Данил Мелентьев</a>
        или в
        <a
          href="https://t.me/melentq"
          target="_blank"
        >Telegram</a>.
      </div>
      <div class="info-modal__row">
        <a
          class="info-modal__github"
          href="https://github.com/ak-alz/pts-plan"
          target="_blank"
          aria-label="GitHub"
        >
          <VIcon name="github" />
        </a>
      </div>
    </div>
  </VModal>
</template>

<style src="./styles.scss"
       lang="scss"
/>
