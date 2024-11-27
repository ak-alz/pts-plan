<script setup>
import {
  computed,
  onMounted, reactive, ref, toRaw,
} from 'vue';
import VButton from '@/vue/ui/button/VButton.vue';
import VLoader from '@/vue/ui/loader/VLoader.vue';
import options from '@/vue/apps/popup/options.json';
import InputsGroup from '@/vue/apps/popup/components/inputs-group/InputsGroup.vue';
import InfoModal from '@/vue/apps/popup/components/info-modal/InfoModal.vue';
import SuccessModal from '@/vue/apps/popup/components/success-modal/SuccessModal.vue';
import SearchForm from '@/vue/apps/popup/components/search-form/SearchForm.vue';
import SearchResult from '@/vue/apps/popup/components/search-result/SearchResult.vue';
import InfoModals from '@/vue/apps/popup/components/info-modals/InfoModals.vue';
import ScrumPointsInfo from '@/vue/apps/popup/components/info-modals/ScrumPointsInfo.vue';
import CommitButtonInfo from '@/vue/apps/popup/components/info-modals/CommitButtonInfo.vue';
import generateInfoModalsState from './generateInfoModalsState';
import generateState from './generateState';

const splitToTerms = (query) => query.split(' ').map((term) => term.trim().toLowerCase());
const hasSearchResult = (query, string) => {
  const terms = splitToTerms(query);

  return terms.some((term) => string.toLowerCase().includes(term));
};

const isLoading = ref(false);
const isSuccessModalVisible = ref(false);
const dontShowSuccessModal = ref(!!window.localStorage.getItem('dontShow'));
const state = reactive(generateState(options.groups));
const infoModalsState = reactive(generateInfoModalsState(options.groups));
const groups = ref(JSON.parse(JSON.stringify(options.groups)));
const search = ref('');

const showSearchNotice = computed(() => search.value && search.value.length < 3);
const showSearchResult = computed(() => search.value.length >= 3);
const filteredInputs = computed(() => {
  const allInputs = groups.value.reduce((acc, group) => acc.concat(group.inputs), []);

  if (!search.value) return allInputs;

  return allInputs
    .filter(({ name, keywords }) => (keywords.length
      ? keywords.some((keyword) => hasSearchResult(search.value, keyword))
      : name.toLowerCase().includes(search.value.toLowerCase())));
});

const loadOptions = () => {
  chrome?.storage?.local?.get(['options'])
    .then((res) => {
      Object.assign(state, res.options);
    });
};

const saveOptions = () => {
  isLoading.value = true;

  chrome?.storage?.local?.set({
    options: toRaw(state),
  })
    .then(() => {
      setTimeout(() => {
        isLoading.value = false;
        if (!dontShowSuccessModal.value) {
          isSuccessModalVisible.value = true;
        }
      }, 300);
    });
};

const onOpenModal = (id) => {
  infoModalsState[id] = true;
};

onMounted(loadOptions);
</script>

<template>
  <form
    class="extension-popup"
    @submit.prevent="saveOptions"
  >
    <div class="extension-popup__inner">
      <div class="extension-popup__head">
        <div class="extension-popup__title-wrapper">
          <img
            src="/icon.png"
            alt="Icon"
          >
          <h1 class="extension-popup__title">
            Pixel Plan Injection
          </h1>

          <InfoModal />
        </div>
        <div class="extension-popup__description">
          Расширение функционала сайта
          <a
            href="https://plan.pixelplus.ru/"
            target="_blank"
          >
            Пиксель План
            <span>24</span>
          </a>
        </div>
      </div>

      <SearchForm v-model="search" />

      <div
        v-if="showSearchNotice"
        class="extension-popup__notice"
      >
        Введите хотя бы 3 символа
      </div>

      <SearchResult
        v-if="showSearchResult"
        v-model="state"
        :inputs="filteredInputs"
        @open-modal="onOpenModal"
      />

      <template v-if="!search">
        <InputsGroup
          v-for="(group, i) in groups"
          :key="i"
          v-model="state"
          :group
          @open-modal="onOpenModal"
        />
      </template>
    </div>

    <div class="extension-popup__footer">
      <VButton
        type="submit"
        :disabled="isLoading"
      >
        <VLoader v-if="isLoading" />
        Сохранить
      </VButton>
      <SuccessModal
        v-model:show-modal="isSuccessModalVisible"
        v-model:dont-show="dontShowSuccessModal"
      />
    </div>
  </form>
  <InfoModals v-model="infoModalsState">
    <template #isScrumPoints>
      <ScrumPointsInfo />
    </template>
    <template #isCommitButton>
      <CommitButtonInfo />
    </template>
  </InfoModals>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
