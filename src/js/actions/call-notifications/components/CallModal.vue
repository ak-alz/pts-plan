<script setup>
import {Button, Dialog} from 'primevue';
import {ref} from 'vue';

const props = defineProps({
  meeting: {
    type: Object,
    default: null,
  },
  title: {
    type: String,
    default: '',
  },
  muted: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['accept', 'dismiss', 'toggle-mute']);

// Крестик закрывает окно так же, как кнопка «Скрыть» (отмена созвона). Диалог контролируемый
// (:visible завязан на meeting), поэтому закрытие по X превращаем в тот же dismiss
function onHide(value) {
  if (!value) emit('dismiss');
}

const linkCopied = ref(false);

async function copyLink() {
  if (!props.meeting?.link) return;
  await navigator.clipboard.writeText(props.meeting.link);
  linkCopied.value = true;
  setTimeout(() => {
    linkCopied.value = false;
  }, 1500);
}
</script>

<template>
  <Dialog
    :visible="!!meeting"
    modal
    :close-on-escape="false"
    :draggable="false"
    :style="{width: '400px'}"
    @update:visible="onHide"
  >
    <template #header>
      <div class="flex items-center gap-2 w-full">
        <span class="p-dialog-title grow break-words">
          {{ title }}
        </span>
        <Button
          v-tooltip.bottom="muted ? 'Включить звук' : 'Выключить звук'"
          :icon="muted ? 'pi pi-volume-off' : 'pi pi-volume-up'"
          severity="secondary"
          text
          rounded
          size="small"
          @click="emit('toggle-mute')"
        />
      </div>
    </template>

    <div
      v-if="meeting?.link"
      class="flex items-center gap-2 mb-4"
    >
      <a
        :href="meeting.link"
        target="_blank"
        rel="noopener"
        class="text-sm text-primary truncate hover:underline flex-1 min-w-0"
      >{{ meeting.link }}</a>
      <Button
        v-tooltip.bottom="linkCopied ? 'Скопировано!' : 'Скопировать ссылку'"
        :icon="linkCopied ? 'pi pi-check' : 'pi pi-copy'"
        severity="secondary"
        text
        size="small"
        @click="copyLink"
      />
    </div>

    <div class="flex gap-3 justify-end">
      <Button
        label="Скрыть"
        severity="secondary"
        @click="emit('dismiss')"
      />
      <Button
        label="Присоединиться"
        severity="primary"
        @click="emit('accept')"
      />
    </div>
  </Dialog>
</template>
