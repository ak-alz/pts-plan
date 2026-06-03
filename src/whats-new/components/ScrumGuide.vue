<script setup>
import { Panel } from 'primevue';

import options from '../../js/options.js';
import OptionsTree from '../../popup/components/OptionsTree.vue';

const form = defineModel({ type: Object, required: true });

const optionsByKey = Object.fromEntries(options.map((option) => [option.key, option]));

function features(...keys) {
  return keys.map((key) => optionsByKey[key]).filter(Boolean);
}
</script>

<template>
  <div class="flex flex-col gap-6 w-[820px] text-sm text-slate-700 leading-relaxed">
    <p class="m-0 text-slate-500">
      Это модифицированный Scrum от команды Пиксель Тулс. Вы вправе адаптировать любые правила под свою команду.
    </p>

    <section class="flex flex-col gap-3">
      <h3 class="m-0 text-[13px] font-semibold text-slate-700 uppercase tracking-wide">
        Как устроен процесс
      </h3>
      <ul class="m-0 pl-5 list-disc flex flex-col gap-1.5">
        <li>Спринт длится <strong>1 неделю</strong>. Каждый день — короткое совещание: быстрый чек кто что сделал и какие есть вопросы. Первый созвон спринта длиннее — на нём происходит планирование и распределение задач.</li>
        <li>В начале спринта задачи из Backlog распределяются между сотрудниками и переносятся в колонку Спринт. Ориентир — <strong>65 баллов</strong> на человека за спринт. Рекомендуется вести таблицу приоритетов (например, в Google Sheets) — разработчики ориентируются на неё при формировании спринта.</li>
        <li>В конце спринта руководитель подводит итоги: считает выполненные баллы каждого и добавляет один общий комментарий в задачу-архив.</li>
      </ul>
      <div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex flex-col gap-2">
        <OptionsTree
          v-model="form"
          :options="features('sprintPriorities')"
        />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="m-0 text-[13px] font-semibold text-slate-700 uppercase tracking-wide">
        Колонки канбана
      </h3>
      <ul class="m-0 pl-5 list-disc flex flex-col gap-1.5">
        <li><strong>Backlog</strong> — общий пул задач команды.</li>
        <li><strong>Декомпозированные</strong> — крупные задачи, разбитые на подзадачи и находящиеся в работе. Задача в этой колонке — это долг: она будет тянуться из спринта в спринт, пока все подзадачи не будут закрыты.</li>
        <li><strong>HotFix</strong> — срочные исправления, которые не могут ждать следующего спринта.</li>
        <li><strong>Спринт</strong> — задачи текущего спринта. Пополняется только в момент планирования.</li>
        <li><strong>В работе</strong> — то, над чем работаешь прямо сейчас. <strong>Только одна задача на человека</strong> — пока не закончил текущую, новую не берёшь.</li>
        <li><strong>Тестирование</strong> — задача выполнена и ждёт проверки.</li>
        <li><strong>На выкат</strong> — проверено, готово к публикации.</li>
        <li><strong>Done</strong> — опубликовано. Сюда попадают в том числе выполненные подзадачи, даже если корневая задача ещё не вышла в прод. <strong>Задачу нельзя закрывать до подведения итогов спринта</strong> — закрытые задачи Битрикс автоматически скрывает в канбане. После того как руководитель добавил комментарий с итогами, задачи из «Done» закрываются.</li>
      </ul>
      <div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex flex-col gap-2">
        <OptionsTree
          v-model="form"
          :options="features('scrumPoints')"
        />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="m-0 text-[13px] font-semibold text-slate-700 uppercase tracking-wide">
        Формат названия задачи
      </h3>
      <p class="m-0 font-mono text-slate-800">
        «Место | Название | Баллы»
      </p>
      <p class="m-0">
        Секции разделяются через «<strong>|</strong>». Между обязательными можно добавлять любые уточнения.
      </p>
      <ul class="m-0 pl-5 list-disc flex flex-col gap-1.5">
        <li><strong>Место</strong> — модуль или проект верхнего уровня: <em>General, Admin, API, Landing</em>.</li>
        <li><strong>Дополнительные секции</strong> — по желанию. Например, стек: <em>F (Frontend), B (Backend)</em>.</li>
        <li><strong>Название</strong> — 3–7 слов, суть задачи.</li>
        <li><strong>Баллы</strong> — оценка сложности: 1, 2, 3, 5, 8, 13, 21. Если оценить сложно — пишите <strong>«?»</strong>, оценка уточняется на планировании. Если задача крупная и ещё не декомпозирована — пишите <strong>«13+»</strong>, <strong>«21+»</strong> или <strong>«100+»</strong>.</li>
      </ul>
      <ul class="m-0 pl-5 list-disc flex flex-col gap-1 text-slate-500 italic">
        <li>Landing | Вёрстка главного экрана | 8</li>
        <li>API | B | Эндпоинт авторизации через OAuth | 13</li>
        <li>Admin | F | Таблица пользователей с фильтрами | 5</li>
      </ul>
      <p class="m-0">
        Если в процессе работы появились правки, не входившие в ТЗ, и они тянут более чем на 3 балла — заводите отдельную задачу в Backlog.
      </p>
      <div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex flex-col gap-2">
        <OptionsTree
          v-model="form"
          :options="features('quickTask', 'editTaskTitle')"
        />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="m-0 text-[13px] font-semibold text-slate-700 uppercase tracking-wide">
        Формат коммитов
      </h3>
      <p class="m-0">
        Берётся полное название задачи, секция с баллами заменяется на ID задачи. Так по коммиту можно мгновенно найти задачу в Битрикс24.
      </p>
      <ul class="m-0 pl-5 list-disc flex flex-col gap-1 text-slate-500 italic">
        <li>Landing | Вёрстка главного экрана | 8 → Landing | Вёрстка главного экрана | 12453</li>
        <li>API | B | Эндпоинт авторизации через OAuth | 13 → API | B | Эндпоинт авторизации через OAuth | 12480</li>
      </ul>
      <div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex flex-col gap-2">
        <OptionsTree
          v-model="form"
          :options="features('commitButton', 'kanbanCommitButton')"
        />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="m-0 text-[13px] font-semibold text-slate-700 uppercase tracking-wide">
        Оценка сложности
      </h3>
      <p class="m-0">
        Оцениваем задачи в баллах Фибоначчи — ориентируемся на <strong>сложность, а не на время</strong>.
      </p>
      <ul class="m-0 pl-5 list-disc flex flex-col gap-1.5">
        <li><strong>1, 2, 3</strong> — понятно как делать, решается в несколько строк кода.</li>
        <li><strong>5, 8</strong> — уже делал подобное, знаешь как подойти.</li>
        <li><strong>13</strong> — нужно разобраться: погуглить, подумать, возможно поэкспериментировать.</li>
        <li><strong>21+</strong> — задача слишком большая, нужна декомпозиция.</li>
      </ul>
      <ul class="m-0 pl-5 list-disc flex flex-col gap-1.5">
        <li>Используете нейросети? Занижайте оценку — они реально упрощают задачи.</li>
        <li>По факту выполнения скорректируйте баллы в обе стороны, если задача оказалась проще или сложнее.</li>
      </ul>
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="m-0 text-[13px] font-semibold text-slate-700 uppercase tracking-wide">
        Декомпозиция
      </h3>
      <p class="m-0">
        Декомпозиция <strong>необязательна</strong>. Если задача до 13 баллов и её выполняет один человек — работайте с ней напрямую.
      </p>
      <p class="m-0">
        Основная декомпозиция происходит на планировании спринта: когда задача доходит по приоритетам, команда вместе обсуждает сложность, разбивает её на подзадачи и распределяет между сотрудниками.
      </p>
      <p class="m-0">
        Если задача сложнее 13 баллов:
      </p>
      <ul class="m-0 pl-5 list-disc flex flex-col gap-1.5">
        <li>Составьте план и создайте подзадачи по 1–13 баллов в Backlog.</li>
        <li>Подзадачи, входящие в спринт, переносятся в Спринт. Остальные ждут в Backlog.</li>
        <li>Корневая задача с <strong>0 баллов</strong> отправляется в Декомпозированные.</li>
        <li>Берите подзадачи по одной. Подзадачи обычно сразу закрываются в Done — тестировать каждую по отдельности нет смысла и это тратит время тестировщика.</li>
        <li>Когда все подзадачи готовы — отправляйте корневую задачу на тестирование целиком.</li>
      </ul>
      <p class="m-0">
        <strong>Хак «задача-ждун».</strong> Если задача сделана, но не может выйти в прод, пока тестируется основной функционал — создайте подзадачу с баллами за выполненную работу, а у корневой поставьте 0. Подзадача уйдёт в Done и попадёт в итоги спринта.
      </p>
      <div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex flex-col gap-2">
        <OptionsTree
          v-model="form"
          :options="features('decomposeTask')"
        />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="m-0 text-[13px] font-semibold text-slate-700 uppercase tracking-wide">
        Итоги спринта
      </h3>
      <p class="m-0">
        В итоги засчитываются баллы за задачи в колонке <strong>Done</strong> — как самостоятельные задачи, так и подзадачи. Корневая задача при этом может ещё не быть на проде.
      </p>
      <p class="m-0">
        В конце спринта руководитель добавляет <strong>один</strong> комментарий к задаче-архиву с итогами каждого участника.
      </p>
      <Panel
        header="Пример комментария"
        toggleable
        :collapsed="true"
      >
        <div class="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2.5 text-[12px] leading-relaxed text-slate-600 flex flex-col gap-1">
          <p class="m-0">
            TAGALL,
          </p>
          <p class="m-0">
            Итоги 42 спринта
          </p>
          <p class="m-0">
            247 баллов!
          </p>
          <p class="m-0">
            <a
              href="#"
              class="text-blue-600 underline"
              @click.prevent
            >Иван Иванов</a> — 89 баллов
          </p>
          <p class="m-0">
            <a
              href="#"
              class="text-blue-600 underline"
              @click.prevent
            >Пётр Петров</a> — 55 баллов
          </p>
          <p class="m-0">
            <a
              href="#"
              class="text-blue-600 underline"
              @click.prevent
            >Мария Сидорова</a> — 34 балла
          </p>
          <p class="m-0">
            <a
              href="#"
              class="text-blue-600 underline"
              @click.prevent
            >Алексей Кузнецов</a> — 21 балл
          </p>
          <p class="m-0">
            <a
              href="#"
              class="text-blue-600 underline"
              @click.prevent
            >Анна Смирнова</a> — 13 баллов
          </p>
        </div>
      </Panel>
      <div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex flex-col gap-2">
        <OptionsTree
          v-model="form"
          :options="features('scrumSummary', 'sprintHistory', 'taskAnalysis')"
        />
      </div>
    </section>
  </div>
</template>
