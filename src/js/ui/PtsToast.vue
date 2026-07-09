<script setup>
import {Toast} from 'primevue';

/**
 * Единый тост для контент-скриптовых виджетов: иконка по severity, ссылки (`message.links`)
 * и анимированная линия таймера автозакрытия, которая приостанавливается при наведении курсора.
 * @param {string} group - группа тоста, должна совпадать со значением `group` в вызовах `toast.add()`.
 * @param {string} [position] - позиция на экране (проп `position` у PrimeVue `Toast`).
 */
defineProps({
  group: {
    type: String,
    required: true,
  },
  position: {
    type: String,
    default: 'bottom-right',
  },
});

const SEVERITY_ICONS = {
  info: 'pi-info-circle',
  success: 'pi-check',
  warn: 'pi-exclamation-triangle',
  error: 'pi-times-circle',
};

const DETAIL_PREFIX = '[pts-plan]: ';

function severityIcon(severity) {
  return SEVERITY_ICONS[severity] ?? SEVERITY_ICONS.info;
}

// Наличие любого коллбэка в onMouseEnter/onMouseLeave включает встроенную в PrimeVue паузу
// таймера автозакрытия при наведении (см. primevue/toast/ToastMessage.vue) — без него паузы нет.
function keepAliveOnHover() {}
</script>

<template>
  <Toast
    :group
    :position
    :on-mouse-enter="keepAliveOnHover"
    :on-mouse-leave="keepAliveOnHover"
  >
    <template #message="{ message }">
      <div class="flex flex-col gap-2 flex-1 min-w-0">
        <div class="flex items-start gap-2">
          <i
            class="pi p-toast-message-icon"
            :class="severityIcon(message.severity)"
          />
          <div class="flex flex-col gap-1 flex-1 min-w-0">
            <span class="p-toast-summary">{{ message.summary }}</span>
            <div
              v-if="message.detail"
              class="p-toast-detail"
            >
              {{ DETAIL_PREFIX }}{{ message.detail }}
            </div>
            <ul
              v-if="message.links?.length"
              class="m-0 pl-4 flex flex-col gap-1"
            >
              <li
                v-for="link in message.links"
                :key="link.id ?? link.url"
              >
                <a
                  :href="link.url"
                  target="_blank"
                  rel="noopener"
                >{{ link.label }}</a>
              </li>
            </ul>
          </div>
        </div>
        <div
          v-if="message.life"
          class="h-[3px] w-full rounded-full overflow-hidden"
        >
          <div
            class="pts-toast-progress-bar h-full w-full bg-current"
            :style="{ animationDuration: `${message.life}ms` }"
          />
        </div>
      </div>
    </template>
  </Toast>
</template>
