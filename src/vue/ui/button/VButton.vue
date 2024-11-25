<script setup>
defineProps({
  type: {
    type: String,
    default: 'button',
  },
});
</script>

<template>
  <button
    :type
    class="button"
  >
    <slot />
  </button>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
