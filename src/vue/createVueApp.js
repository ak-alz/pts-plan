import { createApp } from 'vue';

export default function createVueApp(
  container = window.document.body,
  name = 'app',
  app = {},
  props = {},
) {
  if (document.querySelector(`#app-${name}`)) return;

  const appContainer = Object.assign(document.createElement('div'), {
    id: `app-${name}`,
  });

  container.append(appContainer);

  createApp(app, props).mount(appContainer);
}
