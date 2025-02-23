<script setup>
import image from '@/images/commit.jpg';
</script>

<template>
  <div class="info-modal">
    <div class="info-modal__title">
      Кнопка для коммитов
    </div>
    <div class="info-modal__row">
      На страницу задачи в заголовок добавляет кнопку.
      При нажатии копирует в буфер обмена текст в формате:
      «Описание задачи | ID задачи»
    </div>
    <img
      :src="image"
      alt="Кнопка"
    >
    <div class="info-modal__row">
      Пример: задача с названием «General | F | Вёрстка лендинга для нового функционала | 13»
      и id 343587. После нажатия на кнопку в буфер обмена вставится текст
      «General | F | Вёрстка лендинга для нового функционала | 343587»
    </div>
    <div class="info-modal__row">
      Функционал для разработчиков
    </div>
  </div>
</template>

<style scoped
       lang="scss"
>

</style>
