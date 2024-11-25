<script setup>
import { onMounted, onUnmounted } from 'vue';
import VIcon from '@/vue/ui/icon/VIcon.vue';

defineProps({
  size: {
    type: String,
    default: '',
    validator(value) {
      return ['large', 'big', 'small'].includes(value);
    },
  },
});

const isOpen = defineModel({
  type: Boolean,
  required: true,
});

const handleClose = () => {
  isOpen.value = false;
};

const closeOnEsc = (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    handleClose();
  }
};

onMounted(() => {
  document.addEventListener('keydown', closeOnEsc);
});

onUnmounted(() => {
  document.removeEventListener('keydown', closeOnEsc);
});
</script>

<template>
  <teleport
    defer
    to="body"
  >
    <transition>
      <div
        v-if="isOpen"
        class="modal"
        :class="size ? `modal--${size}` : ''"
        @mousedown.self="handleClose"
        @keydown.esc="handleClose"
      >
        <div class="modal__window">
          <button
            class="modal__close"
            type="button"
            aria-label="Закрыть"
            @click="isOpen = false"
          >
            <VIcon name="close" />
          </button>
          <div class="modal__content">
            <slot />
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
