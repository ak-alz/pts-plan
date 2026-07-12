<script setup>
import { debounce } from 'lodash-es';
import { Button, Dialog, IconField, InputIcon, InputText, SelectButton, Toast } from 'primevue';
import { computed, onMounted, reactive, ref, toRaw, watch } from 'vue';

import options, { groups, optionTypes } from '../js/options.js';
import { convertKeyboardLayout } from '../js/utils.js';
import ImportExportContent from './components/ImportExportContent.vue';
import OptionsTree from './components/OptionsTree.vue';
import ProfileSettings from './components/ProfileSettings.vue';

const search = ref('');
const selectedGroup = ref('all');

watch(search, (val) => {
  if (val) selectedGroup.value = 'all';
});

const profileKeys = new Set(['userFirstName', 'userLastName', 'userId', 'pixelToolsApiKey']);

const groupOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Новые', value: 'new' },
  { label: 'Рекомендую', value: 'popular', tooltip: 'Подойдет для большинства пользователей.' },
  ...groups.filter((g) => g.key !== 'profile').map((g) => ({ label: g.label, value: g.key })),
  { label: 'Прочее', value: 'other' },
];

const groupOrder = Object.fromEntries(groups.map((g, i) => [g.key, i]));

const filteredOptions = computed(() => {
  const searchValue = search.value.toLowerCase();
  const convertedSearchValue = convertKeyboardLayout(searchValue);
  return options
    .filter((option) => {
      if (profileKeys.has(option.key)) return false;
      const matchesSearch = [searchValue, convertedSearchValue].some((value) =>
        option.name.toLowerCase().includes(value) || option.tip?.toLowerCase()?.includes(value));
      const matchesGroup = selectedGroup.value === 'all'
        || (selectedGroup.value === 'new' && option.new)
        || (selectedGroup.value === 'popular' && (option.popularity ?? 0) >= 80)
        || (selectedGroup.value === 'other' ? !option.groups?.length : option.groups?.includes(selectedGroup.value));
      return matchesSearch && matchesGroup;
    })
    .sort((a, b) => {
      const popDiff = (b.popularity ?? 0) - (a.popularity ?? 0);
      if (popDiff !== 0) return popDiff;
      const aIdx = Math.min(...(a.groups?.map((g) => groupOrder[g] ?? Infinity) ?? [Infinity]));
      const bIdx = Math.min(...(b.groups?.map((g) => groupOrder[g] ?? Infinity) ?? [Infinity]));
      return aIdx - bIdx;
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
        case optionTypes.MULTISELECT: {
          result[option.key] = option.default ?? [];
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

let form = reactive(getOptionsMap());
const loaded = ref(false);

async function loadSettings() {
  const { options } = await chrome.storage.local.get(['options']);
  Object.assign(form, options);
  loaded.value = true;
}

const saveSettings = debounce(async () => {
  await chrome.storage.local.set({
    options: toRaw(form),
  });
}, 500);

watch(form, () => {
  if (loaded.value) {
    saveSettings();
  }
}, { deep: true });

const infoModalOpened = ref(false);
const profileModalOpened = ref(false);
const importExportModalOpened = ref(false);

function onImportApply(importedOptions) {
  if (importedOptions) Object.assign(form, importedOptions);
  importExportModalOpened.value = false;
}

function openWhatsNew() {
  chrome.tabs.create({ url: chrome.runtime.getURL('whats-new.html') });
}

function openSetup() {
  chrome.tabs.create({ url: chrome.runtime.getURL('whats-new.html?setup=1') });
}

function openScrumGuide() {
  chrome.tabs.create({ url: chrome.runtime.getURL('whats-new.html?scrum=1') });
}

onMounted(() => {
  loadSettings();
});
</script>

<template>
  <main class="w-[600px] h-[500px] p-3 flex flex-col gap-3">
    <div class="grow min-h-0 flex gap-3 flex-col">
      <div class="flex gap-1 items-center">
        <IconField class="grow">
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="search"
            placeholder="Поиск"
            fluid
            size="small"
          />
        </IconField>
        <Button
          v-tooltip.left="'Настройки профиля'"
          size="small"
          severity="secondary"
          icon="pi pi-user"
          @click="profileModalOpened = true"
        />
        <Button
          v-tooltip.left="'Импорт / экспорт настроек'"
          size="small"
          severity="secondary"
          text
          icon="pi pi-file-export"
          @click="importExportModalOpened = true"
        />
        <Button
          v-tooltip.left="'Что нового'"
          size="small"
          severity="secondary"
          text
          icon="pi pi-sparkles"
          @click="openWhatsNew"
        />
        <Button
          v-tooltip.left="'О расширении'"
          size="small"
          severity="secondary"
          text
          icon="pi pi-info-circle"
          @click="infoModalOpened = true"
        />
      </div>

      <div class="grow min-h-0 flex gap-3">
        <div class="bg-surface-100 flex flex-col">
          <SelectButton
            v-model="selectedGroup"
            :options="groupOptions"
            option-label="label"
            option-value="value"
            size="small"
            :allow-empty="false"
            :pt="{ root: { class: 'flex-col' } }"
            :dt="{ borderRadius: 0 }"
          >
            <template #option="{ option }">
              <span v-tooltip.right="option.tooltip">{{ option.label }}</span>
            </template>
          </SelectButton>
          <div class="mt-auto p-2 flex flex-col gap-1">
            <Button
              label="Помощь"
              size="small"
              severity="secondary"
              outlined
              fluid
              @click="openSetup"
            />
            <Button
              label="Scrum"
              size="small"
              severity="secondary"
              outlined
              fluid
              @click="openScrumGuide"
            />
          </div>
        </div>

        <div class="grow flex flex-col gap-2 min-h-0 overflow-auto">
          <OptionsTree
            v-if="loaded && filteredOptions.length"
            v-model="form"
            :options="filteredOptions"
          />
          <div
            v-else
            class="grow flex items-center justify-center text-sm text-surface-400"
          >
            Ничего не найдено
          </div>
        </div>
      </div>
    </div>
  </main>

  <Dialog
    v-model:visible="profileModalOpened"
    header="Профиль"
    :draggable="false"
    dismissable-mask
    modal
    :style="{ width: '100%' }"
    class="m-3"
  >
    <ProfileSettings v-model="form" />
  </Dialog>

  <Dialog
    v-model:visible="importExportModalOpened"
    header="Импорт / экспорт настроек"
    :draggable="false"
    dismissable-mask
    modal
    :style="{ width: '100%' }"
    class="m-3"
  >
    <ImportExportContent
      :visible="importExportModalOpened"
      @apply="onImportApply"
    />
  </Dialog>

  <Dialog
    v-model:visible="infoModalOpened"
    header="Pixel Plan Injection"
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
        Расширение работает полностью в вашем браузере: оно не собирает, не хранит и никому не передаёт ваши данные — всё остаётся локально на вашем устройстве.
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
      <p>
        Расширение развивается с поддержкой <a
          class="underline"
          href="https://claude.ai"
          target="_blank"
        >Claude</a> от Anthropic.
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

  <Toast position="bottom-right" />
</template>

<style scoped>

</style>
