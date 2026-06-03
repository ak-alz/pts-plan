<script setup>
import {Button, InputNumber, InputText} from 'primevue';

import FormField from '../../js/ui/FormField.vue';
import {useAutoFill} from '../../popup/useAutoFill.js';

const model = defineModel({
  type: Object,
  required: true,
});

const {autoFill, isFetching} = useAutoFill(model);
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <p class="m-0 text-base font-medium text-slate-800">
        Заполните данные профиля
      </p>
      <p class="m-0 mt-1 text-[13px] text-slate-500">
        Имя, фамилию и ID указывайте точно как в Bitrix24 — по ним расширение находит ваши задачи и упоминания. Заполните автоматически или пропустите — тогда такие функции не появятся.
      </p>
    </div>

    <Button
      label="Заполнить автоматически"
      size="small"
      severity="secondary"
      class="self-start"
      :loading="isFetching"
      @click="autoFill"
    />

    <div class="grid grid-cols-3 gap-3">
      <FormField
        id="setup_firstName"
        label="Имя"
        tip="Имя точно как в вашем профиле Bitrix24."
      >
        <InputText
          id="setup_firstName"
          v-model="model.userFirstName"
          size="small"
          fluid
          placeholder="Имя как в Bitrix24"
        />
      </FormField>
      <FormField
        id="setup_lastName"
        label="Фамилия"
        tip="Фамилия точно как в вашем профиле Bitrix24."
      >
        <InputText
          id="setup_lastName"
          v-model="model.userLastName"
          size="small"
          fluid
          placeholder="Фамилия как в Bitrix24"
        />
      </FormField>
      <FormField
        id="setup_userId"
        label="ID"
        tip="Ваш числовой ID в Bitrix24 — его видно в адресе страницы вашего профиля (…/user/12345/)."
      >
        <InputNumber
          id="setup_userId"
          v-model="model.userId"
          size="small"
          fluid
          :use-grouping="false"
          :max-fraction-digits="0"
          placeholder="ID из Bitrix24"
        />
      </FormField>
    </div>
  </div>
</template>
