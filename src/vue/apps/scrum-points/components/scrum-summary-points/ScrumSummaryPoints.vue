<script setup>
import { computed, inject, ref } from 'vue';
import VIcon from '@/vue/ui/icon/VIcon.vue';

const props = defineProps({
  column: {
    type: Number,
    required: true,
  },
  users: {
    type: Array,
    default() {
      return [];
    },
  },
});

const settings = inject('settings');

const emits = defineEmits(['copy']);

const isCopied = ref(false);

const summary = computed(() => {
  let result = 0;
  props.users.forEach((user) => {
    if (user.columns[props.column]) {
      user.columns[props.column].forEach(({ points }) => {
        result += points.value;
      });
    }
  });

  return result;
});

const onClick = () => {
  emits('copy', props.column);
  isCopied.value = true;

  setTimeout(() => {
    isCopied.value = false;
  }, 3000);
};
</script>

<template>
  <td>
    <div class="scrum-summary-points">
      {{ summary }}
      <button
        v-if="settings.showCopyButton"
        class="scrum-summary-points__button"
        :class="{ copied: isCopied }"
        type="button"
        @click="onClick"
      >
        <VIcon name="copy" />
      </button>
    </div>
  </td>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
