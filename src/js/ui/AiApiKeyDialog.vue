<script setup>
import { Button, Dialog, Password } from 'primevue';
import { ref, watch } from 'vue';

const emit = defineEmits(['saved']);
/**
 * Диалог ввода API-ключа Пиксель Тулс для AI-функций: сохраняет ключ в общие опции
 * (`options.pixelToolsApiKey`) и сообщает об этом событием `saved` — обычно следом повторяют
 * запрос к нейросети, который упёрся в отсутствующий или неверный ключ.
 */
const visible = defineModel('visible', { type: Boolean, default: false });
const apiKey = ref('');

watch(visible, (isVisible) => {
  if (isVisible) apiKey.value = '';
});

async function save() {
  const key = apiKey.value.trim();
  if (!key) return;

  const { options } = await chrome.storage.local.get(['options']);
  await chrome.storage.local.set({ options: { ...(options ?? {}), pixelToolsApiKey: key } });
  visible.value = false;
  emit('saved');
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    header="API ключ Пиксель Тулс"
    dismissable-mask
    modal
    :style="{ width: '400px' }"
  >
    <form @submit.prevent="save">
      <Password
        v-model="apiKey"
        size="small"
        :feedback="false"
        toggle-mask
        fluid
        placeholder="Введите API ключ"
        :input-props="{ autocomplete: 'new-password' }"
      />
      <p class="text-xs text-surface-400 dark:text-surface-500 mt-1 mb-3">
        <a
          href="https://tools.pixelplus.ru/"
          target="_blank"
          class="underline"
        >tools.pixelplus.ru</a>
        → Меню → Настройки аккаунта → Ключ для доступа по API
      </p>
      <Button
        type="submit"
        label="Сохранить"
        size="small"
        :disabled="!apiKey.trim()"
      />
    </form>
  </Dialog>
</template>
