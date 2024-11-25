<script setup>
import { computed, ref } from 'vue';
import InputsTree from '@/vue/apps/popup/components/inputs-tree/InputsTree.vue';
import ToggleButton from '@/vue/apps/popup/components/toggle-button/ToggleButton.vue';
import VIcon from '@/vue/ui/icon/VIcon.vue';

const props = defineProps({
  group: {
    type: Object,
    required: true,
  },
});

const state = defineModel({
  type: Object,
  required: true,
});

const localStorageName = computed(() => `vue-accordion-${props.group.key.toString()}`);
const isActive = ref(!!window.localStorage.getItem(localStorageName.value));

const checkboxes = computed(() => props.group.inputs
  .filter(({ type }) => type === 'checkbox'));
const checkedCheckboxes = computed(() => checkboxes.value
  .filter(({ key }) => state.value[key]));
const toggleButtonStatus = computed(() => {
  if (!checkedCheckboxes.value.length) {
    return '';
  }
  if (checkedCheckboxes.value.length === props.group.inputs.length) {
    return 'checked';
  }

  return 'some';
});
const hasNewFeatures = computed(() => props.group.inputs.some(({ isNew }) => isNew));

const onClick = () => {
  isActive.value = !isActive.value;

  if (isActive.value) {
    window.localStorage.setItem(localStorageName.value, true);
  } else {
    window.localStorage.removeItem(localStorageName.value);
  }
};

const start = (el) => {
  el.style.height = `${el.scrollHeight}px`;
};

const end = (el) => {
  el.style.height = null;
};

const onToggle = () => {
  const checked = !toggleButtonStatus.value || toggleButtonStatus.value === 'some';

  checkboxes.value.forEach(({ key }) => {
    state.value[key] = checked;
  });
};

const emits = defineEmits(['openModal']);

const onOpenModal = (id) => {
  emits('openModal', id);
};
</script>

<template>
  <div
    class="inputs-group"
    :class="{ active: isActive }"
  >
    <div class="inputs-group__head">
      <ToggleButton
        v-if="group.withCounter"
        :status="toggleButtonStatus"
        @click="onToggle"
      />
      <button
        class="inputs-group__button"
        type="button"
        @click="onClick"
      >
        {{ group.name }}
        <template v-if="group.withCounter">
          ({{ checkedCheckboxes.length }}/{{ group.inputs.length }})
        </template>
        <VIcon name="chevron" />
      </button>
      <div
        v-if="hasNewFeatures"
        class="inputs-group__new"
      >
        new
      </div>
    </div>
    <transition
      @enter="start"
      @after-enter="end"
      @before-leave="start"
      @after-leave="end"
    >
      <div
        v-show="isActive"
        class="inputs-group__body-wrapper"
      >
        <div class="inputs-group__body">
          <InputsTree
            v-model="state"
            :inputs="group.inputs"
            @open-modal="onOpenModal"
          />
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
