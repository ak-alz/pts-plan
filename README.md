# Pixel Plan Injection (pts-plan)

## О расширении

Это неофициальное расширение для браузера, которое делает интерфейс Пиксель План 24 более удобным, читаемым и приятным.

По вопросам, идеям и отзывам пишите:
- В Plan: [Данил Мелентьев](https://plan.pixelplus.ru/company/personal/user/4594/)
- В Telegram: [@melentq](https://t.me/melentq)

[Ссылка на расширение](https://chromewebstore.google.com/detail/pixel-plan-injection/eegoledaddiobcdgpdmpjcbcelcildio)

## Функционал

Расширение оптимизирует работу в Bitrix24, улучшая визуальное оформление упоминаний, цитат и новых комментариев. Оно добавляет инструменты аналитики для спринтов, кнопки для быстрого управления уведомлениями и автоматизацию рутинных действий, таких как генерация названий коммитов и выбор пользователей. Также предусмотрены полезные мелочи: отображение названия проекта во вкладке браузера, работа с длинными ссылками и декоративный баннер с котами.

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
* В Vue-компонентах внутри `content-script` не используйте блок `style`. Это ломает приложение из-за особенностей сборщика. Пишите стили через Tailwind или инлайн.
* Всё остальное - по аналогии с текущим кодом. Сохраняйте стиль и используйте линтеры.
* Не забывайте менять версию расширения в `package.json`
* После каждого обновления автоматически открывается страница «Что нового». Перед релизом добавьте новый объект в начало массива в `src/whats-new/changelog.js` с полями `version`, `date`, `description`, `images`. Изображения кладите в `public/assets/whats-new/`.

### Превью фич (WebM)

Превью для подсказок опций и страницы настройки лежат в `src/assets/setup/`. Имя файла = ключ фичи из `options.js` (например, `taskSearch.webm`).

Перед добавлением сжимай видео через ffmpeg — двухпроходное кодирование VP9, масштаб 300px, 20 fps:

```bash
ffmpeg -i input.mp4 -c:v libvpx-vp9 -crf 42 -b:v 0 -vf "fps=20,scale=300:-2:flags=lanczos" -an -pass 1 -f null /dev/null
ffmpeg -i input.mp4 -c:v libvpx-vp9 -crf 42 -b:v 0 -vf "fps=20,scale=300:-2:flags=lanczos" -an -pass 2 output.webm
```

Параметры: `-crf 42` — качество (33–50, выше = меньше файл), `-an` — без звука, `scale=300:-2` — ширина 300px с автовысотой. Типичный результат — 40–400 КБ на 15–30 секунд.

### Линтеры

> ⚠️ Включи в своём IDE

* ESLint
* Stylelint

```bash
npx eslint --fix
```
