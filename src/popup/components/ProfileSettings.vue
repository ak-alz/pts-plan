<script setup>
import { Button, InputNumber, InputText, Message, Password } from 'primevue';

import FormField from '../../js/ui/FormField.vue';
import { useAutoFill } from '../useAutoFill.js';

const model = defineModel({ type: Object, required: true });

const { autoFill, isFetching, fetchError } = useAutoFill(model);
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
    <Message
      v-if="fetchError"
      severity="error"
      size="small"
    >
      Не удалось получить данные. Убедитесь, что вы авторизованы на plan.pixelplus.ru
    </Message>
    <FormField
      id="profile_firstName"
      label="Имя"
      tip="Ваше имя в Bitrix24 (нужно для некоторых фич)"
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
      tip="Ваша фамилия в Bitrix24 (нужно для некоторых фич)"
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
      tip="Ваш ID в Bitrix24 (нужно для некоторых фич)"
    >
      <InputNumber
        id="profile_userId"
        v-model="model.userId"
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
      tip="Нужен для AI-функций расширения. Сгенерировать можно в настройках аккаунта на tools.pixelplus.ru"
    >
      <Password
        id="profile_pixelToolsApiKey"
        v-model="model.pixelToolsApiKey"
        size="small"
        fluid
        :feedback="false"
        toggle-mask
        placeholder="Введите API ключ"
      />
      <p class="text-xs text-surface-400 mt-1">
        <a
          href="https://tools.pixelplus.ru/"
          target="_blank"
          class="underline"
        >tools.pixelplus.ru</a>
        → Меню → Настройки аккаунта → Ключ для доступа по API
      </p>
    </FormField>
  </div>
</template>
