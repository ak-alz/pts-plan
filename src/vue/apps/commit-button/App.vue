<script setup>
import VIcon from '@/vue/ui/icon/VIcon.vue';
import { ref } from 'vue';
import getTaskId from '@/functions/core/getTaskId';

const button = ref(null);

const isCopied = ref(false);

const onClick = () => {
  const wrapper = button.value.closest('.pagetitle');
  if (!wrapper) return;

  const title = wrapper.querySelector('.pagetitle-item');
  if (!title) return;

  const taskId = getTaskId();
  if (!taskId) return;

  const parts = title.textContent.split('|').map((x) => x.trim()).filter((x) => !!x);

  const longestPart = parts.reduce(
    (a, b) => (a.length > b.length ? a : b),
  );

  navigator.clipboard.writeText(`${longestPart} | ${taskId}`);

  isCopied.value = true;

  setTimeout(() => {
    isCopied.value = false;
  }, 3000);
};
</script>

<template>
  <button
    ref="button"
    class="commit-button"
    :class="{ copied: isCopied }"
    type="button"
    @click="onClick"
  >
    <VIcon name="github" />
  </button>
</template>

<style src="./styles.scss"
       lang="scss"
/>
