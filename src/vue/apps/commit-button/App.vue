<script setup>
import VIcon from '@/vue/ui/icon/VIcon.vue';
import { ref } from 'vue';
import getTaskId from '@/functions/core/getTaskId';

const button = ref(null);

const isCopied = ref(false);

const onClick = () => {
  const wrapper = button.value.closest('.pagetitle');
  if (!wrapper) return;

  let title = wrapper.querySelector('.pagetitle-item');
  if (!title) return;

  const taskId = getTaskId();
  if (!taskId) return;

  const popupTitle = title.querySelector('.task-popup-pagetitle-item');
  if (popupTitle) {
    title = popupTitle;
  }

  const parts = title.textContent
    .split('|')
    .map((x) => x.trim())
    .filter((x) => !!x);
  const lastPart = parts[parts.length - 1];
  const lastPartIsPointsPart = lastPart.length < 4; // 100+
  if (lastPartIsPointsPart) {
    parts.pop();
  }
  parts.push(taskId);

  navigator.clipboard.writeText(parts.join(' | '));

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
