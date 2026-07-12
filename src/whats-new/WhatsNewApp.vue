<script setup>
import {Accordion, AccordionContent, AccordionHeader, AccordionPanel, Checkbox, Dialog, Toast} from 'primevue';
import {onMounted, reactive, ref, toRaw, watch} from 'vue';

import options, {optionTypes} from '../js/options.js';
import OptionsTree from '../popup/components/OptionsTree.vue';
import changelog from './changelog.js';
import ScrumBanner from './components/ScrumBanner.vue';
import ScrumGuide from './components/ScrumGuide.vue';
import SetupBanner from './components/SetupBanner.vue';
import SetupWizard from './components/SetupWizard.vue';

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

let form = reactive(getOptionsMap());

async function loadSettings() {
  const {options: stored} = await chrome.storage.local.get(['options']);
  if (stored) Object.assign(form, stored);
}

async function saveSettings() {
  await chrome.storage.local.set({options: toRaw(form)});
}

const setupVisible = ref(false);
const scrumVisible = ref(false);
const disableAutoWhatsNew = ref(false);

async function loadDisableAutoWhatsNew() {
  const {disableAutoWhatsNew: stored} = await chrome.storage.local.get(['disableAutoWhatsNew']);
  disableAutoWhatsNew.value = stored ?? false;
}

function openSetup() {
  setupVisible.value = true;
}

function onSetupComplete() {
  setupVisible.value = false;
}

onMounted(async () => {
  await Promise.all([loadSettings(), loadDisableAutoWhatsNew()]);

  watch(form, saveSettings, {deep: true});
  watch(disableAutoWhatsNew, (value) => chrome.storage.local.set({disableAutoWhatsNew: value}));

  // Новый юзер (после install) и кнопка из попапа ведут сюда с ?setup=1 — сразу открываем быструю настройку.
  const params = new URLSearchParams(window.location.search);
  if (params.get('setup') === '1') {
    setupVisible.value = true;
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (params.get('scrum') === '1') {
    scrumVisible.value = true;
    window.history.replaceState({}, '', window.location.pathname);
  }

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

function resolvedOptions(item) {
  const keys = item.optionKeys ?? (item.optionKey ? [item.optionKey] : []);
  return keys.map(k => optionsByKey[k]).filter(Boolean);
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
      <div class="flex-1">
        <h1 class="m-0 text-xl font-bold text-slate-800">
          Pixel Plan Injection
        </h1>
        <p class="m-0 text-[13px] text-slate-500">
          Что нового в расширении
        </p>
      </div>
      <label class="flex items-center gap-2 text-[13px] text-slate-500 cursor-pointer select-none">
        <Checkbox
          v-model="disableAutoWhatsNew"
          binary
          input-id="disable-auto-whats-new"
        />
        Не открывать эту страницу автоматически при обновлениях
      </label>
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

    <div class="flex gap-8 items-start">
      <div class="flex-1 min-w-0">
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
            </AccordionContent>
          </AccordionPanel>
        </Accordion>
      </div>

      <div class="w-52 shrink-0 sticky top-6 flex flex-col gap-3">
        <SetupBanner @open="openSetup" />
        <ScrumBanner @open="scrumVisible = true" />
      </div>
    </div>
  </div>

  <Dialog
    v-model:visible="scrumVisible"
    header="Scrum в Пиксель Тулс"
    :draggable="false"
    modal
    :style="{ width: '900px' }"
    :breakpoints="{ '900px': '95vw' }"
  >
    <ScrumGuide v-model="form" />
  </Dialog>

  <Dialog
    v-model:visible="setupVisible"
    header="Быстрая настройка"
    :draggable="false"
    modal
    :style="{ width: '800px' }"
    :breakpoints="{ '800px': '95vw' }"
  >
    <SetupWizard
      v-model="form"
      @complete="onSetupComplete"
    />
  </Dialog>

  <Toast position="bottom-right" />
</template>
