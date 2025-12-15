<script setup>
import { Button, Dialog, IconField, InputIcon, InputText, Toast } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref, toRaw } from 'vue';

import options, { optionTypes } from '../js/options.js';
import OptionsTree from './components/OptionsTree.vue';

const toast = useToast();

const search = ref('');

const filteredOptions = computed(() => {
  return options
    .filter((option) => {
      return option.name.toLowerCase().includes(search.value.toLowerCase())
        || option.tip?.toLowerCase()?.includes(search.value.toLowerCase());
    });
});

function getOptionsMap() {
  const result = {};

  function recursive(opts) {
    opts.forEach((option) => {
      switch (option.type) {
        case optionTypes.TEXT:
        case optionTypes.COLOR: {
          result[option.key] = option.default || '';
          break;
        }
        case optionTypes.NUMBER: {
          result[option.key] = option.default || null;
          break;
        }
        default: {
          result[option.key] = option.default || false;
        }
      }

      if (option.options) {
        recursive(option.options);
      }
    });
  }

  recursive(options);

  return result;
}

const form = reactive(getOptionsMap());

async function loadSettings() {
  const { options } = await chrome.storage.local.get(['options']);
  Object.assign(form, options);
}

async function saveSettings() {
  await chrome.storage.local.set({
    options: toRaw(form),
  });

  toast.add({
    severity: 'success',
    summary: 'Сохранено',
    detail: 'Перезагрузите страницу, чтобы применить настройки.',
    life: 10000,
  });
}

const infoModalOpened = ref(false);

onMounted(() => {
  loadSettings();
});
</script>

<template>
  <main class="w-[300px] h-[400px] p-3 flex flex-col gap-3">
    <form
      class="grow flex gap-3 flex-col"
      @submit.prevent="saveSettings"
    >
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="search"
          placeholder="Поиск"
          fluid
          size="small"
        />
      </IconField>

      <div class="grow flex flex-col gap-2 max-h-[282px] overflow-auto">
        <OptionsTree
          v-model="form"
          :options="filteredOptions"
        />
      </div>

      <div class="flex gap-1">
        <Button
          label="Сохранить"
          fluid
          size="small"
          type="submit"
        />
        <Button
          v-tooltip="'О расширении'"
          class="mx-auto"
          size="small"
          severity="secondary"
          link
          icon="pi pi-info-circle"
          @click="infoModalOpened = true"
        />
      </div>
    </form>
  </main>

  <Dialog
    v-model:visible="infoModalOpened"
    header="О расширении"
    :draggable="false"
    dismissable-mask
    modal
    :style="{ width: '100%' }"
    class="m-3"
  >
    <div class="flex flex-col gap-1 items-center text-center">
      <p>
        Это обновлённая версия <a
          class="underline"
          href="https://chromewebstore.google.com/detail/planpixelplusru-injection/mhfnfibgbpoejngckfodcahflmgalkgc"
          target="_blank"
        >plan.pixelplus.ru Injection</a> от Алексея Каракчеева.
      </p>
      <p>
        Расширение добавляет удобные улучшения для работы с сайтом <a
          class="underline"
          href="https://plan.pixelplus.ru/"
          target="_blank"
        >Пиксель План 24</a>.
      </p>
      <p>
        Исходный код полностью открыт на GitHub - приветствуются предложения, issues и pull requests!
      </p>
      <p>
        Также пишите идеи и отзывы в Plan <a
          class="underline"
          href="https://plan.pixelplus.ru/company/personal/user/4594/"
          target="_blank"
        >Данил Мелентьев</a> или в <a
          class="underline"
          href="https://t.me/melentq"
          target="_blank"
        >Telegram</a>.
      </p>
      <p>
        Стек: <a
          class="underline"
          href="https://github.com/guocaoyi/create-chrome-ext"
          target="_blank"
        >CRX</a>, PrimeVue, Tailwind.
      </p>
      <a
        class="mt-1"
        href="https://github.com/ak-alz/pts-plan"
        target="_blank"
      >
        <i class="pi pi-github" />
      </a>
    </div>
  </Dialog>

  <Toast
    :dt="{
      width: 'calc(100% - 40px)'
    }"
  />
</template>

<style scoped>

</style>
