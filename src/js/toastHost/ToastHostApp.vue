<script setup>
import {useToast} from 'primevue/usetoast';
import {onMounted, onUnmounted} from 'vue';

import PtsToast from '../ui/PtsToast.vue';
import {notifyToastClosed, onRemoveToast, onShowToast, TOAST_GROUP} from './showToast.js';

const toast = useToast();

let unsubscribeShow;
let unsubscribeRemove;

onMounted(() => {
  unsubscribeShow = onShowToast((message) => toast.add({...message, group: TOAST_GROUP}));
  unsubscribeRemove = onRemoveToast((id) => toast.remove({id}));
});

onUnmounted(() => {
  unsubscribeShow?.();
  unsubscribeRemove?.();
});

function handleToastClosed({message}) {
  notifyToastClosed(message);
}
</script>

<template>
  <PtsToast
    :group="TOAST_GROUP"
    @close="handleToastClosed"
    @life-end="handleToastClosed"
  />
</template>
