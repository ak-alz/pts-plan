<script setup>
import dayjs from 'dayjs';
import { computed } from 'vue';

import { validateHexColor } from '../../js/utils.js';

const props = defineProps({
  options: {
    type: Object,
    default() {
      return {};
    },
  },
  new: {
    type: Boolean,
    default: false,
  },
  quote: {
    type: Boolean,
    default: false,
  },
});

const keyMap = {
  tagAllColor: { enabled: 'tagAllColor', value: 'tagAllColorColor' },
  userNameColor: { enabled: 'userNameColor', value: 'userNameColorColor' },
  userNameBackground: { enabled: 'userNameColor', value: 'userNameColorBackground' },
  userNameBorder: { enabled: 'userNameColor', value: 'userNameColorBorder' },
  newCommentBackground: { enabled: 'newCommentColor', value: 'newCommentColorBackground' },
  quoteBackground: { enabled: 'quoteColor', value: 'quoteColorBackground' },
  quoteBorder: { enabled: 'quoteColor', value: 'quoteColorBorder' },
};

function getColor(slot) {
  const { enabled, value } = keyMap[slot];
  const val = props.options[value];
  return props.options[enabled] && validateHexColor(val) ? val : null;
}

const tagAllColor = computed(() => getColor('tagAllColor') ?? 'inherit');
const tagAllFontWeight = computed(() => getColor('tagAllColor') ? '700' : '400');

const userNameColor = computed(() => getColor('userNameColor') ?? '#2066b0');
const userNameFontWeight = computed(() => getColor('userNameColor') ? '700' : '400');

const commentBackground = computed(() => {
  if (props.new) {
    const bg = getColor('newCommentBackground');
    if (bg) return bg;
  }
  return getColor('userNameBackground') ?? '#edf1f3';
});

const commentBorder = computed(() => getColor('userNameBorder') ?? commentBackground.value);

const quoteBackground = computed(() => getColor('quoteBackground') ?? '#f3f6f7');
const quoteBorder = computed(() => getColor('quoteBorder') ?? '#e0e2e3');

const userName = computed(() => {
  if (props.options.userFirstName && props.options.userLastName) {
    return `${props.options.userFirstName} ${props.options.userLastName}`;
  }

  return 'Имя Фамилия';
});
</script>

<template>
  <div class="comment-demo">
    <div class="comment-demo__head">
      <div class="comment-demo__name">
        Иван Иванов
      </div>
      <div class="comment-demo__time">
        {{ dayjs().format('D MMMM HH:mm') }}
      </div>
    </div>
    <div class="comment-demo__body">
      <div
        v-if="quote"
        class="comment-demo__quote"
      >
        <span class="tag-all-highlight">TAGALL</span>, <span class="user-name-highlight">{{ userName }}</span>
        Коллеги, задача готова к проверке. Жду обратной связи!
      </div>
      <template v-else>
        <span class="tag-all-highlight">TAGALL</span>, <span class="user-name-highlight">{{ userName }}</span>
        Коллеги, задача готова к проверке. Жду обратной связи!
      </template>
    </div>
  </div>
</template>

<style scoped>
.comment-demo {
  max-width: 210px;
  padding: 6px 10px;
  border-radius: 10px;
  background-color: v-bind(commentBackground);
  color: #151515;
  border-width: 1px;
  border-style: solid;
  border-color: v-bind(commentBorder);
}

.comment-demo__head {
  margin-bottom: 6px;
}

.comment-demo__name {
  display: inline;
  color: #2066b0;
  font-weight: 600;
}

.comment-demo__time {
  display: inline;
  color: #bcc2c7;
  font-size: 0.8em;
}

.comment-demo__quote {
  border-radius: 10px;
  padding: 5px 5px 5px 18px;
  background-color: v-bind(quoteBackground);
  border-width: 1px;
  border-style: solid;
  border-color: v-bind(quoteBorder);
  background-image: url(data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%228%22%20height%3D%2214%22%3E%3Cpath%20fill%3D%22%23BBC1C5%22%20fill-rule%3D%22evenodd%22%20d%3D%22M0%2011.813C2.563%2010.6%203.844%209.171%203.844%207.531c-1.104-.121-2.01-.551-2.719-1.29C.417%205.5.063%204.646.063%203.675c0-1.033.348-1.903%201.046-2.612C1.807.354%202.677%200%203.72%200c1.146%200%202.146.46%203%201.382C7.573%202.303%208%203.422%208%204.738%208%208.685%205.74%2011.773%201.219%2014L0%2011.813z%22/%3E%3C/svg%3E);
  background-position: 6px 8px;
  background-size: 6px 10px;
  background-repeat: no-repeat;
}

.tag-all-highlight {
  font-weight: v-bind(tagAllFontWeight);
  color: v-bind(tagAllColor);
}

.user-name-highlight {
  font-weight: v-bind(userNameFontWeight);
  color: v-bind(userNameColor);
}
</style>
