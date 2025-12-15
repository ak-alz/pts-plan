# Pixel Plan Injection (pts-plan)

## О расширении

Это неофициальное расширение для браузера, которое делает интерфейс Пиксель План 24 более удобным, читаемым и приятным.

По вопросам, идеям и отзывам пишите:
- В Plan: [Данил Мелентьев](https://plan.pixelplus.ru/company/personal/user/4594/)
- В Telegram: [@melentq](https://t.me/melentq)

[Ссылка на расширение](https://chromewebstore.google.com/detail/pixel-plan-injection/eegoledaddiobcdgpdmpjcbcelcildio)

## Функционал

- Настраиваемые цветовые пресеты для комментариев
- Цветные имена пользователей в комментариях
- Выделение метки `TAGALL` ярким цветом
- Разноцветные фоновые подсветки новых (непрочитанных) комментариев
- Стилизация цитат с цветной левой рамкой
- Превью выбранного дизайна прямо в настройках расширения
- И многое другое

Все цвета спокойные, светлые и идеально вписываются в светлую тему Bitrix24 / Пиксель План.

## Разработка

### Запуск в режиме разработки

```bash
npm run dev
```

### Сборка для публикации

```bash
npm run build
```

### Стек

* [Create Chrome Extension (.crx)](https://github.com/guocaoyi/create-chrome-ext)
* [PrimeVue](https://primevue.org/)
* [Tailwind CSS](https://tailwindcss.com/)

### Особенности разработки

* Основная логика находится в `src/content-scripts/isolated.js`. Файл `src/content-scripts/main.js` используется только для передачи `sessionId`.
* Стили для `content-script` не обновляются в hot-reload. Если добавляете новый Tailwind-класс - перезапустите сборку (`npm run dev`), чтобы он попал в бандл.
* В Vue-компонентах внутри `content-script` не используйте блок <style>. Это ломает приложение из-за особенностей сборщика. Пишите стили через Tailwind или инлайн.
* Всё остальное - по аналогии с текущим кодом. Сохраняйте стиль и используйте линтеры.

### Линтеры

> ⚠️ Включи в своём IDE

* ESLint
* Stylelint

```bash
npx eslint src/**/*.{js,vue} --fix
```
