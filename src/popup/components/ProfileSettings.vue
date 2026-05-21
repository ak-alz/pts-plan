<script setup>
import { Button, Dialog, InputNumber, InputText, Message } from 'primevue';
import { ref } from 'vue';

import FormField from '../../js/ui/FormField.vue';
import { useAutoFill } from '../useAutoFill.js';

const model = defineModel({ type: Object, required: true });

const visible = ref(false);
const { autoFill, isFetching, fetchError } = useAutoFill(model);
</script>

<template>
  <Button
    v-tooltip.left="'Настройки профиля'"
    size="small"
    severity="secondary"
    link
    icon="pi pi-user"
    @click="visible = true"
  />

  <Dialog
    v-model:visible="visible"
    header="Профиль"
    :draggable="false"
    dismissable-mask
    modal
    :style="{ width: '100%' }"
    class="m-3"
  >
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
    </div>
  </Dialog>
</template>
