<script setup>
import { computed } from 'vue';
import VInput from '@/vue/ui/input/VInput.vue';
import ColorPicker from '@/vue/ui/color-picker/ColorPicker.vue';
import VCheckbox from '@/vue/ui/checkbox/VCheckbox.vue';
import VTip from '@/vue/ui/tip/VTip.vue';

const state = defineModel({
  type: Object,
  required: true,
});

const props = defineProps({
  inputs: {
    type: Array,
    default() {
      return [];
    },
  },
  level: {
    type: Number,
    default: 0,
  },
});

const leftMargin = computed(() => `${props.level * 30}px`);

const emits = defineEmits(['openModal']);

const onOpenModal = (id) => {
  emits('openModal', id);
};
</script>

<template>
  <div class="inputs-tree">
    <template
      v-for="input in inputs"
      :key="input.key"
    >
      <div
        class="inputs-tree__element"
        :class="{ new: input.isNew }"
      >
        <VCheckbox
          v-if="input.type === 'checkbox'"
          v-model="state[input.key]"
          :label="input.name"
        />
        <ColorPicker
          v-else-if="input.type === 'color-picker'"
          v-model="state[input.key]"
          :label="input.name"
        />
        <VInput
          v-else
          v-model="state[input.key]"
          :placeholder="input.name"
        />
        <VTip
          v-if="input.hasInfoModal"
          @click="$emit('openModal', input.key)"
        />
      </div>
      <InputsTree
        v-if="input.children && state[input.key]"
        v-model="state"
        :inputs="input.children"
        :level="level + 1"
        @open-modal="onOpenModal"
      />
    </template>
  </div>
</template>

<style scoped
       lang="scss"
>
.inputs-tree {
  $block-name: &;

  display: flex;
  flex-direction: column;
  gap: 10px;

  & #{$block-name} {
    gap: 6px;
    margin-top: -4px;
    margin-bottom: 4px;
    margin-left: v-bind(leftMargin);
  }

  &__element {
    display: flex;
    align-items: center;
    gap: 10px;

    & > * {
      flex-grow: 1;
    }
  }
}
</style>

<style lang="scss">
.inputs-tree > .new [class*="__label"]::after {
  display: inline-block;
  padding: 1px 2px;
  margin-left: 5px;

  color: $neutral;

  font-size: 8px;
  line-height: 1;
  letter-spacing: 0.1em;
  text-transform: uppercase;

  border: 1px solid $neutral-light;
  border-radius: 3px;

  pointer-events: none;

  content: 'new';
}
</style>
