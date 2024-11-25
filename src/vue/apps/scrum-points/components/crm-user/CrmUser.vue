<script setup>
defineProps({
  photo: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
});
</script>

<template>
  <div class="crm-user">
    <div class="crm-user__photo">
      <img
        :src="photo"
        :alt="name"
      >
    </div>
    <a
      class="crm-user__name"
      :href="url"
    >
      {{ name }}
    </a>
  </div>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
