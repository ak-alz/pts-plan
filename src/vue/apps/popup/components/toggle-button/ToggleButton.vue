<script setup>
import VIcon from '@/vue/ui/icon/VIcon.vue';

defineProps({
  status: {
    type: String,
    default: '',
    validator(value) {
      return ['some', 'checked'].includes(value);
    },
  },
});
</script>

<template>
  <button
    class="toggle-button"
    :class="status"
    type="button"
  >
    <VIcon
      v-if="status === 'checked'"
      name="checkbox"
    />
  </button>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
