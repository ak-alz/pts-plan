<script setup>
import Accordion from 'primevue/accordion';
import AccordionContent from 'primevue/accordioncontent';
import AccordionHeader from 'primevue/accordionheader';
import AccordionPanel from 'primevue/accordionpanel';
import Galleria from 'primevue/galleria';
import {onMounted, reactive, ref, toRaw, watch} from 'vue';

import options, {optionTypes} from '../js/options.js';
import OptionsTree from '../popup/components/OptionsTree.vue';
import changelog from './changelog.js';

const openVersion = changelog[0]?.version ?? null;

const optionsByKey = Object.fromEntries(options.map(o => [o.key, o]));

function getOptionsMap() {
  const result = {};
  function recursive(opts) {
    opts.forEach((option) => {
      switch (option.type) {
        case optionTypes.TEXT:
        case optionTypes.COLOR:
          result[option.key] = option.default || '';
          break;
        case optionTypes.NUMBER:
          result[option.key] = option.default || null;
          break;
        default:
          result[option.key] = option.default || false;
      }
      if (option.options) recursive(option.options);
    });
  }
  recursive(options);
  return result;
}

const form = reactive(getOptionsMap());

async function loadSettings() {
  const {options: stored} = await chrome.storage.local.get(['options']);
  if (stored) Object.assign(form, stored);
}

async function saveSettings() {
  await chrome.storage.local.set({options: toRaw(form)});
}

onMounted(async () => {
  await loadSettings();
  watch(form, saveSettings, {deep: true});
});

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, {day: 'numeric', month: 'long', year: 'numeric'});
}

const badgeClasses = {
  new: 'bg-green-100 text-green-700',
  fix: 'bg-red-100 text-red-600',
  upd: 'bg-blue-100 text-blue-700',
};

const badgeLabels = {
  new: 'NEW',
  fix: 'FIX',
  upd: 'UPD',
};

const activeIndexMap = reactive({});
const fullscreenVisible = ref(false);
const fullscreenImages = ref([]);
const fullscreenActiveIndex = ref(0);

function openFullscreen(images, version, index = null) {
  fullscreenImages.value = images;
  fullscreenActiveIndex.value = index ?? activeIndexMap[version] ?? 0;
  fullscreenVisible.value = true;
}

function resolvedOptions(item) {
  const keys = item.optionKeys ?? (item.optionKey ? [item.optionKey] : []);
  return keys.map(k => optionsByKey[k]).filter(Boolean);
}

function onFullscreenMaskClick(e) {
  if (e.target === e.currentTarget) fullscreenVisible.value = false;
}
</script>

<template>
  <div class="max-w-5xl mx-auto my-10 px-4 font-sans">
    <div class="flex items-center gap-3 mb-6">
      <img
        src="/img/logo.png"
        alt="logo"
        class="w-9 h-9"
      >
      <div>
        <h1 class="m-0 text-xl font-bold text-slate-800">
          Pixel Plan Injection
        </h1>
        <p class="m-0 text-[13px] text-slate-500">
          Что нового в расширении
        </p>
      </div>
    </div>

    <p class="mb-6 text-sm text-slate-500">
      Есть идеи или пожелания? Пишите в Plan
      <a
        href="https://plan.pixelplus.ru/company/personal/user/4594/"
        target="_blank"
        class="underline text-slate-600"
      >Данил Мелентьев</a>
      или в <a
        href="https://t.me/melentq"
        target="_blank"
        class="underline text-slate-600"
      >Telegram</a> — с удовольствием добавлю.
      <br>Расширение открыто на <a
        href="https://github.com/ak-alz/pts-plan"
        target="_blank"
        class="underline text-slate-600"
      >GitHub</a> — PR приветствуются!
    </p>

    <Accordion :value="openVersion">
      <AccordionPanel
        v-for="entry in changelog"
        :key="entry.version"
        :value="entry.version"
      >
        <AccordionHeader>
          <span class="font-semibold">v{{ entry.version }}</span>
          <span class="ml-2.5 text-xs text-slate-400 font-normal">{{ formatDate(entry.date) }}</span>
        </AccordionHeader>
        <AccordionContent>
          <div class="grid grid-cols-[3fr_2fr] gap-6 items-start">
            <ul class="m-0 p-0 list-none flex flex-col gap-4">
              <li
                v-for="(item, i) in entry.items"
                :key="i"
                class="flex flex-col gap-1.5"
              >
                <div class="flex items-baseline gap-2 text-[14px] text-slate-700">
                  <span
                    class="shrink-0 rounded px-1 py-0.5 text-[10px] font-bold leading-none min-w-[34px] text-center"
                    :class="badgeClasses[item.type]"
                  >{{ badgeLabels[item.type] }}</span>
                  {{ item.text }}
                </div>
                <div
                  v-if="resolvedOptions(item).length"
                  class="ml-[42px] rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex flex-col gap-2"
                >
                  <OptionsTree
                    v-model="form"
                    :options="resolvedOptions(item)"
                  />
                </div>
              </li>
            </ul>
            <Galleria
              v-if="entry.images?.length"
              :value="entry.images"
              :active-index="activeIndexMap[entry.version] ?? 0"
              :num-visible="5"
              show-item-navigators
              circular
              :show-thumbnails="entry.images.length > 1"
              :show-thumbnail-navigators="false"
              @update:active-index="activeIndexMap[entry.version] = $event"
            >
              <template #item="{ item }">
                <div
                  class="relative w-full aspect-video cursor-zoom-in"
                  @click="openFullscreen(entry.images, entry.version)"
                >
                  <img
                    :src="item"
                    alt="Скриншот"
                    class="absolute inset-0 w-full h-full object-contain rounded-lg"
                  >
                </div>
              </template>
              <template #thumbnail="{ item, index }">
                <img
                  :src="item"
                  alt="Скриншот"
                  class="w-16 h-10 object-cover rounded cursor-zoom-in"
                  @click="openFullscreen(entry.images, entry.version, index)"
                >
              </template>
            </Galleria>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>
  </div>

  <Galleria
    v-model:visible="fullscreenVisible"
    v-model:active-index="fullscreenActiveIndex"
    :value="fullscreenImages"
    :num-visible="5"
    full-screen
    show-item-navigators
    circular
    :show-thumbnails="fullscreenImages.length > 1"
    :show-thumbnail-navigators="false"
    :pt="{ mask: { onClick: onFullscreenMaskClick } }"
  >
    <template #item="{ item }">
      <img
        :src="item"
        alt="Скриншот"
        class="max-h-[90vh] max-w-[90vw] object-contain"
      >
    </template>
    <template #thumbnail="{ item }">
      <img
        :src="item"
        alt="Скриншот"
        class="w-16 h-10 object-cover rounded"
      >
    </template>
  </Galleria>
</template>
