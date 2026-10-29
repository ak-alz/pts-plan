<script setup>
import { debounce } from 'lodash-es';
import { Button, InputNumber, InputText, Message, Password, Select } from 'primevue';
import { computed, ref, watch } from 'vue';

import { DEFAULT_MODEL_VALUE, getModelPromptLength } from '../../js/aiModel.js';
import { getAiModels } from '../../js/PixelToolsApi.js';
import FormField from '../../js/ui/FormField.vue';
import { pluralize } from '../../js/utils.js';
import { useAutoFill } from '../useAutoFill.js';

const model = defineModel({ type: Object, required: true });

const { autoFill, isFetching } = useAutoFill(model);

const aiModels = ref([]);
const defaultAiModelValue = ref('');
const aiModelsError = ref('');
const isLoadingAiModels = ref(false);

const aiModelChoices = computed(() => {
  const defaultAiModel = aiModels.value.find((aiModel) => aiModel.value === defaultAiModelValue.value);
  return [
    {
      label: defaultAiModel ? `По умолчанию (${defaultAiModel.name})` : 'По умолчанию',
      value: DEFAULT_MODEL_VALUE,
      promptLength: defaultAiModel && getModelPromptLength(defaultAiModel),
      isVision: defaultAiModel?.isVision,
      isFile: defaultAiModel?.isFile,
    },
    ...aiModels.value.map((aiModel) => ({
      label: aiModel.name,
      value: aiModel.value,
      promptLength: getModelPromptLength(aiModel),
      isVision: aiModel.isVision,
      isFile: aiModel.isFile,
    })),
  ];
});

function formatModelCapabilities(option) {
  return [
    option.isVision && 'изображения',
    option.isFile && 'файлы',
    `до ${option.promptLength.toLocaleString('ru-RU')} ${pluralize(option.promptLength, ['символа', 'символов', 'символов'])}`,
  ].filter(Boolean).join(' · ');
}

// Номер последнего запроса справочника: ключ правят посимвольно, и ответ на устаревший вариант
// ключа не должен затереть список, загруженный по актуальному
let lastModelsRequest = 0;

async function loadAiModels(apiKey) {
  const request = ++lastModelsRequest;
  aiModelsError.value = '';

  if (!apiKey) {
    aiModels.value = [];
    defaultAiModelValue.value = '';
    return;
  }

  isLoadingAiModels.value = true;
  try {
    const { models, defaultModel } = await getAiModels(apiKey);
    if (request !== lastModelsRequest) return;
    aiModels.value = models;
    defaultAiModelValue.value = defaultModel;

    // Сохранённую нейросеть могли отключить в Пиксель Тулс или сменился тариф ключа
    const selected = model.value.pixelToolsAiModel;
    if (selected !== DEFAULT_MODEL_VALUE && !models.some((aiModel) => aiModel.value === selected)) {
      model.value.pixelToolsAiModel = DEFAULT_MODEL_VALUE;
    }
  } catch (error) {
    if (request !== lastModelsRequest) return;
    aiModels.value = [];
    defaultAiModelValue.value = '';
    aiModelsError.value = error.message;
  } finally {
    if (request === lastModelsRequest) isLoadingAiModels.value = false;
  }
}

const loadAiModelsDebounced = debounce(loadAiModels, 600);
let isFirstModelsLoad = true;

watch(() => model.value.pixelToolsApiKey?.trim() ?? '', (apiKey) => {
  // При открытии профиля ключ уже введён — ждать паузу в наборе незачем
  if (isFirstModelsLoad) {
    isFirstModelsLoad = false;
    loadAiModels(apiKey);
    return;
  }
  loadAiModelsDebounced(apiKey);
}, { immediate: true });
</script>

<template>
  <div class="flex flex-col gap-3">
    <Button
      label="Заполнить автоматически"
      icon="pi pi-download"
      size="small"
      severity="secondary"
      :loading="isFetching"
      @click="autoFill"
    />
    <FormField
      id="profile_firstName"
      label="Имя"
      tip="Ваше имя в Bitrix24 (нужно для некоторых функций)"
    >
      <InputText
        id="profile_firstName"
        v-model="model.userFirstName"
        size="small"
        fluid
        placeholder="Ваше имя в Bitrix24"
      />
    </FormField>
    <FormField
      id="profile_lastName"
      label="Фамилия"
      tip="Ваша фамилия в Bitrix24 (нужно для некоторых функций)"
    >
      <InputText
        id="profile_lastName"
        v-model="model.userLastName"
        size="small"
        fluid
        placeholder="Ваша фамилия в Bitrix24"
      />
    </FormField>
    <FormField
      id="profile_userId"
      label="ID пользователя"
      tip="Ваш ID в Bitrix24 (нужно для некоторых функций)"
    >
      <InputNumber
        v-model="model.userId"
        input-id="profile_userId"
        size="small"
        fluid
        :use-grouping="false"
        :max-fraction-digits="0"
        placeholder="Ваш ID в Bitrix24"
      />
    </FormField>
    <FormField
      id="profile_pixelToolsApiKey"
      label="API ключ Пиксель Тулс"
      tip="Нужен для ИИ-функций расширения. Сгенерировать можно в настройках аккаунта на tools.pixelplus.ru"
    >
      <Password
        v-model="model.pixelToolsApiKey"
        input-id="profile_pixelToolsApiKey"
        size="small"
        fluid
        :feedback="false"
        toggle-mask
        placeholder="Введите API ключ"
      />
      <p class="text-xs text-surface-400 dark:text-surface-500 mt-1">
        <a
          href="https://tools.pixelplus.ru/"
          target="_blank"
          class="underline"
        >tools.pixelplus.ru</a>
        → Меню → Настройки аккаунта → Ключ для доступа по API
      </p>
    </FormField>
    <FormField
      id="profile_pixelToolsAiModel"
      label="Нейросеть для ИИ-функций"
      tip="Какой нейросетью выполняются ИИ-функции расширения: быстрое создание задачи и подзадач, улучшение описания задачи, сводка по итогам спринтов, анализ баллов задач, динамика задач группы. Справа у каждой нейросети — что она принимает: изображения и файлы (их можно передать в улучшении описания задачи) и до скольких символов запроса. Список зависит от тарифа вашего ключа и может меняться."
    >
      <Select
        v-model="model.pixelToolsAiModel"
        input-id="profile_pixelToolsAiModel"
        :options="aiModelChoices"
        option-label="label"
        option-value="value"
        size="small"
        fluid
        :loading="isLoadingAiModels"
        :disabled="!model.pixelToolsApiKey?.trim()"
      >
        <template #option="{ option }">
          <div class="flex items-center justify-between gap-3 w-full">
            <span>{{ option.label }}</span>
            <span
              v-if="option.promptLength"
              class="text-xs text-surface-500 dark:text-surface-400 whitespace-nowrap"
            >{{ formatModelCapabilities(option) }}</span>
          </div>
        </template>
      </Select>
      <p
        v-if="!model.pixelToolsApiKey?.trim()"
        class="text-xs text-surface-400 dark:text-surface-500 mt-1"
      >
        Список нейросетей загрузится, когда будет указан API ключ.
      </p>
      <Message
        v-if="aiModelsError"
        severity="error"
        size="small"
        :closable="false"
        class="mt-1"
      >
        {{ aiModelsError }}
      </Message>
    </FormField>
  </div>
</template>
