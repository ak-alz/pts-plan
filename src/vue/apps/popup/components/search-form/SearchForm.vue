<script setup>
import VInput from '@/vue/ui/input/VInput.vue';
import VIcon from '@/vue/ui/icon/VIcon.vue';

const search = defineModel({
  type: String,
  required: true,
});

const onClick = () => {
  search.value = '';
};
</script>

<template>
  <form
    class="search-form"
    :class="{
      filled: search,
    }"
  >
    <VInput
      v-model="search"
      :with-icon="true"
      placeholder="Поиск"
    />
    <button
      type="button"
      class="search-form__button"
      aria-label="Очистить"
      @click="onClick"
    >
      <VIcon
        v-if="search"
        name="close"
      />
      <VIcon
        v-else
        name="search"
      />
    </button>
  </form>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
