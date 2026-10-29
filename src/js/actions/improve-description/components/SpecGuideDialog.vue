<script setup>
import { Carousel, Dialog, Tag } from 'primevue';

import { SPEC_BUG_CRITERIA, SPEC_CRITERIA } from '../variables.js';

const visible = defineModel('visible', { type: Boolean, default: false });

const criteria = SPEC_CRITERIA.map((criterion, index) => ({ ...criterion, number: index + 1 }));

const responsiveOptions = [
  { breakpoint: '767px', numVisible: 1, numScroll: 1 },
];
</script>

<template>
  <Dialog
    v-model:visible="visible"
    header="Как написать хорошее ТЗ"
    dismissable-mask
    modal
    class="w-[860px]"
    :breakpoints="{ '900px': '95vw' }"
  >
    <div class="flex flex-col gap-3 text-sm">
      <p class="m-0">
        Хорошее ТЗ берут и делают без вопросов. Проверка: отдайте его коллеге, который не участвовал в обсуждении, — сможет ли он по примеру сам посчитать, что должно получиться?
      </p>
      <p class="m-0 text-surface-500 dark:text-surface-400">
        {{ criteria.length }} критериев. Начинайте с пункта 1 — он задаёт суть всей задачи. Остальные добивают детали.
      </p>

      <Carousel
        :value="criteria"
        :num-visible="2"
        :num-scroll="2"
        :responsive-options="responsiveOptions"
      >
        <template #item="{ data: criterion }">
          <div class="h-full px-1.5 pb-1">
            <div class="h-full flex flex-col gap-3 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900">
              <div class="flex items-center gap-3">
                <span class="size-8 shrink-0 rounded-full flex items-center justify-center font-bold bg-primary text-primary-contrast">
                  {{ criterion.number }}
                </span>
                <span class="grow font-bold text-base">{{ criterion.title }}</span>
                <Tag
                  :value="criterion.when ?? 'всегда'"
                  :severity="criterion.when ? 'secondary' : 'warn'"
                  class="shrink-0 whitespace-nowrap"
                  rounded
                />
              </div>

              <p
                v-if="criterion.text"
                class="m-0"
              >
                {{ criterion.text }}
              </p>

              <ul
                v-if="criterion.points"
                class="m-0 pl-5 flex flex-col gap-1"
              >
                <li
                  v-for="point in criterion.points"
                  :key="point"
                >
                  {{ point }}
                </li>
              </ul>

              <div
                v-if="criterion.good"
                class="px-3 py-2 rounded-lg border-l-4 border-green-600 bg-green-100 dark:border-green-500 dark:bg-green-900/40"
              >
                <b class="text-green-700 dark:text-green-300">Хорошо:</b> {{ criterion.good }}
              </div>

              <div
                v-if="criterion.bad"
                class="px-3 py-2 rounded-lg border-l-4 border-red-600 bg-red-100 dark:border-red-500 dark:bg-red-900/40"
              >
                <b class="text-red-600 dark:text-red-300">Плохо:</b> {{ criterion.bad }}
              </div>
            </div>
          </div>
        </template>
      </Carousel>

      <p class="m-0">
        <b>Для бага:</b> {{ SPEC_BUG_CRITERIA }}
      </p>

      <p class="m-0">
        На любой пункт можно ответить «не важно, на ваше усмотрение» или «как в соседнем блоке» — это тоже ответ. Плохо, когда пункт просто пропущен.
      </p>

      <p class="m-0">
        <b>Не пишите в задаче</b> пароли, токены, доступы и личные данные: задачу читает нейросеть, и текст уходит на её серверы. Доступы — только в личных сообщениях по запросу исполнителя.
      </p>
    </div>
  </Dialog>
</template>
