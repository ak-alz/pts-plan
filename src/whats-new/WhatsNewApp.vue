<script setup>
import dayjs from 'dayjs';
import {Accordion, AccordionContent, AccordionHeader, AccordionPanel, Button, Checkbox, Dialog, Toast} from 'primevue';
import {onMounted, provide, reactive, ref, toRaw, watch} from 'vue';

import {useTheme} from '../js/composables/useTheme.js';
import options, {optionTypes} from '../js/options.js';
import OptionsTree from '../popup/components/OptionsTree.vue';
import changelog from './changelog.js';
import CallNotificationsBanner from './components/CallNotificationsBanner.vue';
import CallNotificationsGuide from './components/CallNotificationsGuide.vue';
import ScrumBanner from './components/ScrumBanner.vue';
import ScrumGuide from './components/ScrumGuide.vue';
import SetupBanner from './components/SetupBanner.vue';
import SetupWizard from './components/SetupWizard.vue';

const {icon: themeIcon, tooltip: themeTooltip, cycleMode: cycleThemeMode} = useTheme();

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

// Опции можно поменять не только тут (например чекбокс "Уведомления о встречах" в модалке
// настроек этой фичи) — подхватываем внешние изменения, чтобы форма не оставалась в старом виде
function handleOptionsStorageChanged(changes, area) {
  if (area !== 'local' || !changes.options) return;
  Object.assign(form, changes.options.newValue);
}

const setupVisible = ref(false);
const scrumVisible = ref(false);
const callsVisible = ref(false);
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

// Разбор query-параметров, открывающих нужный диалог. Используется и при загрузке страницы
// (ссылки ?setup=1/?scrum=1/?calls=1 из попапа или после установки), и когда кнопка «Настроить»
// в OptionsTree нажата уже на этой же странице — тогда открываем диалог на месте, без новой вкладки
function applySettingsFromSearch(search) {
  const params = new URLSearchParams(search);
  if (params.get('setup') === '1') setupVisible.value = true;
  if (params.get('scrum') === '1') scrumVisible.value = true;
  if (params.get('calls') === '1') callsVisible.value = true;
}

provide('openSettingsInPlace', applySettingsFromSearch);

onMounted(async () => {
  await Promise.all([loadSettings(), loadDisableAutoWhatsNew()]);

  watch(form, saveSettings, {deep: true});
  watch(disableAutoWhatsNew, (value) => chrome.storage.local.set({disableAutoWhatsNew: value}));
  chrome.storage.onChanged.addListener(handleOptionsStorageChanged);

  applySettingsFromSearch(window.location.search);
  window.history.replaceState({}, '', window.location.pathname);
});

function formatDate(dateStr) {
  return dayjs(dateStr).format('LL');
}

const badgeClasses = {
  new: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  fix: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300',
  upd: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
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
    <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <img
          src="/img/logo.png"
          alt="logo"
          class="w-9 h-9 shrink-0"
        >
        <div class="min-w-0">
          <h1 class="m-0 text-xl font-bold text-surface-800 dark:text-surface-0">
            Pixel Plan Injection
          </h1>
          <p class="m-0 text-[13px] text-surface-500 dark:text-surface-400">
            Что нового в расширении
          </p>
        </div>
      </div>
      <label class="flex items-center gap-2 text-[13px] text-surface-500 dark:text-surface-400 cursor-pointer select-none">
        <Checkbox
          v-model="disableAutoWhatsNew"
          binary
          input-id="disable-auto-whats-new"
        />
        Не открывать эту страницу автоматически при обновлениях
      </label>
      <Button
        v-tooltip.left="themeTooltip"
        size="small"
        severity="secondary"
        text
        :icon="`pi ${themeIcon}`"
        @click="cycleThemeMode"
      />
    </div>

    <p class="mb-6 text-sm text-surface-500 dark:text-surface-400">
      Есть идеи или пожелания? Пишите в Plan
      <a
        href="https://plan.pixelplus.ru/company/personal/user/4594/"
        target="_blank"
        class="underline text-surface-600 dark:text-surface-300"
      >Данил Мелентьев</a>
      или в <a
        href="https://t.me/melentq"
        target="_blank"
        class="underline text-surface-600 dark:text-surface-300"
      >Telegram</a> — с удовольствием добавлю.
      <br>Расширение открыто на <a
        href="https://github.com/ak-alz/pts-plan"
        target="_blank"
        class="underline text-surface-600 dark:text-surface-300"
      >GitHub</a> — PR приветствуются!
    </p>

    <div class="flex flex-col md:flex-row gap-8 items-start">
      <div class="flex-1 min-w-0 w-full">
        <Accordion :value="openVersion">
          <AccordionPanel
            v-for="entry in changelog"
            :key="entry.version"
            :value="entry.version"
          >
            <AccordionHeader>
              <span class="font-semibold">v{{ entry.version }}</span>
              <span class="ml-2.5 text-xs text-surface-400 dark:text-surface-500 font-normal">{{ formatDate(entry.date) }}</span>
            </AccordionHeader>
            <AccordionContent>
              <ul class="m-0 p-0 list-none flex flex-col gap-4">
                <li
                  v-for="(item, i) in entry.items"
                  :key="i"
                  class="flex flex-col gap-1.5"
                >
                  <div class="flex items-baseline gap-2 text-[14px] text-surface-700 dark:text-surface-0">
                    <span
                      class="shrink-0 rounded px-1 py-0.5 text-[10px] font-bold leading-none min-w-[34px] text-center"
                      :class="badgeClasses[item.type]"
                    >{{ badgeLabels[item.type] }}</span>
                    {{ item.text }}
                  </div>
                  <div
                    v-if="resolvedOptions(item).length"
                    class="ml-[42px] rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 px-3 py-2 flex flex-col gap-2"
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

      <div class="w-full md:w-52 shrink-0 md:sticky md:top-6 flex flex-col gap-3 order-first md:order-none">
        <SetupBanner @open="openSetup" />
        <ScrumBanner @open="scrumVisible = true" />
        <CallNotificationsBanner @open="callsVisible = true" />
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
    v-model:visible="callsVisible"
    header="Уведомления о встречах"
    :draggable="false"
    modal
    :style="{ width: '760px' }"
    :breakpoints="{ '760px': '95vw' }"
  >
    <CallNotificationsGuide />
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
