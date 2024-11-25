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
      Подойдет как для менеджеров, так и для сотрудиков.
    </div>
    <img
      :src="image"
      alt="Кнопка"
    >
    <div class="info-modal__row">
      Для корректной работы необоходимо, чтобы задачи назывались правильно, по шаблону:
      <i>«Название задачи и дополнительная информация | Баллы задачи»</i>,
      например, <i>«General | Переход на SCRUM | 100+»</i>
    </div>
  </div>
</template>

<style scoped
       lang="scss"
>

</style>
