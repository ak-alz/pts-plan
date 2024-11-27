<script setup>
import image from '@/images/scrum.jpg';
</script>

<template>
  <div class="info-modal">
    <div class="info-modal__title">
      Таблица баллов спринта
    </div>
    <div class="info-modal__row">
      На странице канбана добавляет кнопку, открывающую окно с таблицей.
      Внутри множество удобного функционала.
    </div>
    <img
      :src="image"
      alt="Кнопка"
    >
    <div class="info-modal__row">
      Для корректной работы необоходимо, чтобы задачи назывались правильно, по шаблону:
      <i>«Название задачи | Баллы задачи»</i>,
      например, <i>«General | F | Вёрстка лендинга для нового функционала | 13»</i>
    </div>
    <div>
      Функционал для менеджеров и сотрудиков.
    </div>
  </div>
</template>

<style scoped
       lang="scss"
>

</style>
