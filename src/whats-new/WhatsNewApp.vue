<script setup>
import Accordion from 'primevue/accordion';
import AccordionContent from 'primevue/accordioncontent';
import AccordionHeader from 'primevue/accordionheader';
import AccordionPanel from 'primevue/accordionpanel';
import Galleria from 'primevue/galleria';

import changelog from './changelog.js';

const openVersion = changelog[0]?.version ?? null;

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
</script>

<template>
  <div class="max-w-[680px] mx-auto mt-10 px-4 font-sans">
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
      Расширение открыто на <a
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
          <ul class="m-0 p-0 list-none flex flex-col gap-1.5 text-[14px] text-slate-700">
            <li
              v-for="(item, i) in entry.items"
              :key="i"
              class="flex items-baseline gap-2"
            >
              <span
                class="shrink-0 rounded px-1 py-0.5 text-[10px] font-bold leading-none min-w-[34px] text-center"
                :class="badgeClasses[item.type]"
              >{{ badgeLabels[item.type] }}</span>
              {{ item.text }}
            </li>
          </ul>
          <div
            v-if="entry.images.length"
            class="mt-3"
          >
            <Galleria
              :value="entry.images"
              :num-visible="5"
              show-item-navigators
              circular
              :show-thumbnail-navigators="false"
            >
              <template #item="{ item }">
                <div
                  class="relative w-full pointer-events-none"
                  style="aspect-ratio: 16/9;"
                >
                  <img
                    :src="item"
                    alt="Скриншот"
                    class="absolute inset-0 w-full h-full object-contain rounded-lg"
                  >
                </div>
              </template>
              <template #thumbnail="{ item }">
                <img
                  :src="item"
                  alt="Скриншот"
                  class="w-16 h-10 object-cover rounded"
                >
              </template>
            </Galleria>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>
  </div>
</template>
