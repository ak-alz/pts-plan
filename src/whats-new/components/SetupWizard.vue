<script setup>
import {Button} from 'primevue';
import {computed, reactive, ref} from 'vue';

import featuresSource from '../../js/options.js';
import steps from './setup-steps.js';
import SetupProfile from './SetupProfile.vue';
import SetupQuestion from './SetupQuestion.vue';
import SetupResults from './SetupResults.vue';
import SetupStart from './SetupStart.vue';

const emit = defineEmits(['complete']);

const model = defineModel({
  type: Object,
  required: true,
});

const RESULTS_ID = 'results';

const quizFeatures = featuresSource.filter(feature => feature.action && !feature.excludeFromSetup);
const featuresByKey = Object.fromEntries(quizFeatures.map(feature => [feature.key, feature]));
const initiallyEnabled = new Set(quizFeatures.filter(feature => model.value?.[feature.key]).map(feature => feature.key));
const nothingToOffer = quizFeatures.every(feature => initiallyEnabled.has(feature.key));

const profileStep = steps.find(step => step.type === 'profile');
const questionSteps = steps.filter(step => step.type === 'single' || step.type === 'multi');

const answers = reactive({});
questionSteps.forEach((step) => {
  if (step.default !== undefined) {
    answers[step.id] = Array.isArray(step.default) ? [...step.default] : step.default;
  } else {
    answers[step.id] = step.type === 'multi' ? [] : null;
  }
});

// Профильные требования (ФИО/ID) у фичи или варианта ответа: выполнены, только если поля заполнены.
function needsSatisfied(item) {
  if (!item.needs) return true;
  return item.needs.every((key) => {
    const value = model.value?.[key];
    return value !== '' && value !== null && value !== undefined;
  });
}

function isOfferable(key) {
  const feature = featuresByKey[key];
  if (!feature) return false;
  if (initiallyEnabled.has(feature.key)) return false;
  return needsSatisfied(feature);
}

// Полезен ли вариант: даёт ли он хоть одну ещё не включённую фичу (свою или общую для вопроса).
function optionIsUseful(step, option) {
  return [...(step.features ?? []), ...(option.features ?? [])].some(isOfferable);
}

// Варианты ответа с учётом условий: профильные needs (ФИО/ID) и предикат visibleIf.
// Бесполезные варианты прячем только у multi (чекбоксы независимы). У single радиокнопки не прячем поштучно —
// пропавший вариант роли выглядел бы как баг; бесполезный вопрос целиком отсеивается в visibleSteps.
function visibleOptions(step) {
  return step.options.filter(option =>
    needsSatisfied(option)
    && (!option.visibleIf || option.visibleIf(answers))
    && (step.type !== 'multi' || optionIsUseful(step, option)),
  );
}

// Ключи фич, привязанные к шагу: уровень вопроса (step.features) + выбранные видимые варианты (option.features).
function keysFromStep(step) {
  const answer = answers[step.id];
  const answered = step.type === 'multi' ? !!answer?.length : answer != null;
  if (!answered) return [];
  const keys = [...(step.features ?? [])];
  const options = visibleOptions(step);
  const selected = step.type === 'multi'
    ? options.filter(option => answer.includes(option.value))
    : options.filter(option => option.value === answer);
  selected.forEach(option => keys.push(...(option.features ?? [])));
  return keys;
}

function sortByPopularity(features) {
  return [...features].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

// Условные шаги: visibleIf (напр. спринты только при канбане) + пропускаем вопрос, если ни один видимый вариант не даёт новых фич.
const visibleSteps = computed(() => questionSteps.filter((step) => {
  if (step.visibleIf && !step.visibleIf(answers)) return false;
  return visibleOptions(step).some(option => optionIsUseful(step, option));
}));

// Новые фичи каждого вопроса (с дедупом по предыдущим шагам) — для режима «после каждого вопроса».
const resultsByStep = computed(() => {
  const shown = new Set();
  const result = {};
  for (const step of visibleSteps.value) {
    const features = [];
    for (const key of keysFromStep(step)) {
      if (shown.has(key) || !isOfferable(key)) continue;
      shown.add(key);
      features.push(featuresByKey[key]);
    }
    result[step.id] = sortByPopularity(features);
  }
  return result;
});

// Все подобранные фичи единым списком — для режима «в конце».
const allResults = computed(() => sortByPopularity(Object.values(resultsByStep.value).flat()));

const mode = ref('sequential');
const started = ref(false);
const current = ref(null);

const displaySteps = computed(() => {
  const list = [{id: profileStep.id, kind: 'profile'}];
  for (const step of visibleSteps.value) {
    list.push({id: step.id, kind: 'question', step});
    if (mode.value === 'sequential' && resultsByStep.value[step.id].length) {
      list.push({id: `${step.id}-results`, kind: 'results', stepId: step.id});
    }
  }
  if (mode.value !== 'sequential') {
    list.push({id: RESULTS_ID, kind: 'results'});
  }
  return list;
});

const currentScreen = computed(() => displaySteps.value.find(screen => screen.id === current.value) ?? null);
const currentIndex = computed(() => displaySteps.value.findIndex(screen => screen.id === current.value));
const isLast = computed(() => currentIndex.value === displaySteps.value.length - 1);

const currentResults = computed(() => {
  const screen = currentScreen.value;
  if (screen?.kind !== 'results') return [];
  return screen.stepId ? resultsByStep.value[screen.stepId] : allResults.value;
});

const canProceed = computed(() => {
  const screen = currentScreen.value;
  if (screen?.kind === 'question' && screen.step.type === 'single') return answers[screen.step.id] != null;
  return true;
});

function start() {
  started.value = true;
  current.value = displaySteps.value[0].id;
}

function goNext() {
  const ids = displaySteps.value.map(screen => screen.id);
  const index = ids.indexOf(current.value);
  if (index < ids.length - 1) current.value = ids[index + 1];
}

function goBack() {
  const ids = displaySteps.value.map(screen => screen.id);
  const index = ids.indexOf(current.value);
  if (index > 0) current.value = ids[index - 1];
  else started.value = false;
}

function applyDescendantDefaults(options) {
  if (!options) return;
  for (const option of options) {
    if (option.default !== undefined) model.value[option.key] = option.default;
    if (option.options) applyDescendantDefaults(option.options);
  }
}

function enableFeature(feature) {
  model.value[feature.key] = true;
  applyDescendantDefaults(feature.options);
}

function onToggle(feature, value) {
  if (value) enableFeature(feature);
  else model.value[feature.key] = false;
}

function enableAll() {
  currentResults.value.forEach(enableFeature);
}
</script>

<template>
  <div
    v-if="nothingToOffer"
    class="flex flex-col items-center gap-2 py-10 text-center"
  >
    <i class="pi pi-check-circle text-4xl text-green-400" />
    <p class="m-0 text-sm text-slate-600">
      У вас уже включены все функции 🎉<br>Предлагать нечего.
    </p>
    <Button
      label="Закрыть"
      size="small"
      severity="secondary"
      class="mt-2"
      @click="emit('complete')"
    />
  </div>

  <div
    v-else-if="!started"
    class="flex flex-col gap-5"
  >
    <SetupStart v-model="mode" />
    <div class="flex border-t border-slate-200 pt-3">
      <Button
        label="Начать"
        size="small"
        :disabled="!mode"
        @click="start"
      />
    </div>
  </div>

  <div
    v-else
    class="flex flex-col gap-5"
  >
    <div class="min-h-[200px] max-h-[55vh] overflow-y-auto px-0.5">
      <SetupResults
        v-if="currentScreen?.kind === 'results'"
        :features="currentResults"
        :model="model"
        @toggle="onToggle"
        @enable-all="enableAll"
      />
      <SetupProfile
        v-else-if="currentScreen?.kind === 'profile'"
        v-model="model"
      />
      <SetupQuestion
        v-else-if="currentScreen?.kind === 'question'"
        :key="currentScreen.step.id"
        v-model="answers[currentScreen.step.id]"
        :step="currentScreen.step"
        :options="visibleOptions(currentScreen.step)"
      />
    </div>

    <div class="flex items-center gap-2 border-t border-slate-200 pt-3">
      <Button
        label="Назад"
        size="small"
        severity="secondary"
        text
        @click="goBack"
      />
      <Button
        v-if="!isLast"
        label="Далее"
        size="small"
        :disabled="!canProceed"
        @click="goNext"
      />
      <Button
        v-else
        label="Готово"
        size="small"
        @click="emit('complete')"
      />
    </div>
  </div>
</template>
