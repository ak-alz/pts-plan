import {getColors} from '../../utils.js';

/** Порог объёма выгрузки, после которого спрашиваем подтверждение: полгода по крупной группе проходит молча, год и больше — со спросом. */
export const CONFIRM_TASK_COUNT_THRESHOLD = 3000;

/** Задача без активности дольше этого числа дней считается залежавшейся. */
export const STALE_DAYS = 90;

/** Окно скользящего среднего в бакетах. */
export const MOVING_AVERAGE_WINDOW = 3;

export const CUT_OPTIONS = [
  {label: 'Все задачи', value: 'all'},
  {label: 'Только корневые', value: 'root'},
];

export const VALUE_MODE_OPTIONS = [
  {label: 'Значения', value: 'absolute'},
  {label: 'Доли', value: 'share'},
];

export const TAB_OPTIONS = [
  {label: 'Сводка', value: 'summary'},
  {label: 'Поток', value: 'flow'},
  {label: 'Время и планы', value: 'leadTime'},
  {label: 'Баллы и команда', value: 'team'},
  {label: 'Качество', value: 'quality'},
  {label: 'Декомпозиция', value: 'decomposition'},
];

/** Корзины возраста задач бэклога: `maxDays === null` — всё, что старше предыдущей корзины. */
export const AGE_BUCKETS = [
  {key: 'lt30', label: 'до 30 дней', maxDays: 30},
  {key: 'd30_90', label: '30–90 дней', maxDays: 90},
  {key: 'd90_180', label: '90–180 дней', maxDays: 180},
  {key: 'd180_365', label: '180–365 дней', maxDays: 365},
  {key: 'gt365', label: 'больше года', maxDays: null},
];

export const CHART_COLORS = {
  created: getColors('sky', '400'),
  closed: getColors('emerald', '500'),
  debt: getColors('rose', '500'),
  movingAverage: getColors('amber', '500'),
  points: getColors('indigo', '400'),
  people: getColors('teal', '500'),
  pointsPerPerson: getColors('violet', '500'),
  hotfixes: getColors('red', '400'),
  hotfixShare: getColors('orange', '500'),
  leadTimeMedian: getColors('violet', '500'),
  leadTimeP85: getColors('fuchsia', '400'),
  taskSize: getColors('amber', '500'),
  regularLeadTime: getColors('blue', '400'),
  comments: getColors('cyan', '500'),
  decompositionRatio: getColors('purple', '500'),
  stale: getColors('rose', '400'),
};

/** Оттенки для стековых столбцов «распределение размеров» и корзин возраста. */
export const AGE_BUCKET_COLORS = getColors(['emerald', 'lime', 'amber', 'orange', 'rose'], '400');

/**
 * Метрики сводки: один список на таблицу, копирование, CSV и данные для AI.
 * `lowerIsBetter` инвертирует цвет дельты, `format` — способ вывода: `int` целое, `one` один знак,
 * `percent` проценты, `days` дни. В `tip` обязательно сказано, по какой дате метрика бакетируется —
 * без этого цифры вкладок выглядят противоречиво.
 */
export const SUMMARY_METRICS = [
  {key: 'created', label: 'Создано задач', group: 'Объём', format: 'int', tip: 'Число задач, созданных в периоде (по дате создания). Отклонённые задачи не считаются.'},
  {key: 'closed', label: 'Закрыто задач', group: 'Объём', format: 'int', tip: 'Число задач, завершённых в периоде (по дате закрытия).'},
  {key: 'netDebt', label: 'Нетто-долг', group: 'Объём', format: 'int', lowerIsBetter: true, tip: 'Создано минус закрыто. Больше нуля — объём планов за период вырос, меньше нуля — сократился.'},
  {key: 'createdPerMonth', label: 'Создано в месяц', group: 'Объём', format: 'one', tip: 'Создано за период, поделённое на длину периода в месяцах.'},
  {key: 'closedPerMonth', label: 'Закрыто в месяц', group: 'Объём', format: 'one', tip: 'Закрыто за период, поделённое на длину периода в месяцах.'},
  {key: 'points', label: 'Баллы', group: 'Объём', format: 'int', tip: 'Сумма баллов из названий задач, закрытых в периоде.'},
  {key: 'pointsPerMonth', label: 'Баллов в месяц', group: 'Объём', format: 'one', tip: 'Баллы за период, поделённые на длину периода в месяцах.'},
  {key: 'avgPointsPerTask', label: 'Средний размер задачи, баллов', group: 'Объём', format: 'one', tip: 'Баллы, поделённые на число закрытых задач. Задачи без баллов в названии тянут значение вниз — смотрите на строку «Задач с баллами в названии».'},
  {key: 'pointsCoverage', label: 'Задач с баллами в названии', group: 'Объём', format: 'percent', tip: 'Доля закрытых задач, у которых в названии есть баллы. Всё, что считается в баллах, опирается на эту долю.'},

  {key: 'leadTimeMedian', label: 'Медиана от постановки до закрытия', group: 'Время', format: 'days', lowerIsBetter: true, tip: 'Медиана времени от создания задачи до её закрытия, по задачам, закрытым в периоде. Внутрь этого времени входит и ожидание в планах, и ожидание конца спринта — это не скорость работы команды.'},
  {key: 'leadTimeP85', label: '85-й перцентиль от постановки до закрытия', group: 'Время', format: 'days', lowerIsBetter: true, tip: 'У 85% задач, закрытых в периоде, полное время не превышало это значение. Средних по времени не считаем: распределение с длинным хвостом из долгожителей.'},

  {key: 'hotfixes', label: 'Хотфиксов закрыто', group: 'Качество', format: 'int', lowerIsBetter: true, tip: 'Задачи, название которых начинается с «Hotfix». Колонка канбана как признак не годится: закрытая задача всегда уезжает в архивную колонку.'},
  {key: 'hotfixShare', label: 'Доля хотфиксов', group: 'Качество', format: 'percent', lowerIsBetter: true, tip: 'Хотфиксы, поделённые на все закрытые задачи периода.'},
  {key: 'hotfixLeadTimeMedian', label: 'Медиана времени хотфиксов', group: 'Качество', format: 'days', lowerIsBetter: true, tip: 'Медиана времени от постановки до закрытия у хотфиксов.'},
  {key: 'regularLeadTimeMedian', label: 'Медиана времени обычных задач', group: 'Качество', format: 'days', lowerIsBetter: true, tip: 'Медиана времени от постановки до закрытия у задач, кроме хотфиксов — сравнивайте с предыдущей строкой.'},
  {key: 'commentsPerTask', label: 'Комментариев на задачу', group: 'Качество', format: 'one', tip: 'Среднее число комментариев у закрытых задач периода — косвенная мера числа уточнений. Bitrix считает здесь и системные сообщения.'},

  {key: 'roots', label: 'Закрыто корневых задач', group: 'Декомпозиция', format: 'int', tip: 'Закрытые задачи без родителя.'},
  {key: 'subtasksPerRoot', label: 'Задач на корневую', group: 'Декомпозиция', format: 'one', tip: 'Все закрытые задачи периода, поделённые на закрытые корневые. Разрез на эту метрику не влияет: в разрезе «только корневые» делить пришлось бы одно множество на само себя. Считается плоско, по задачам периода: если родитель закрыт вне периода, его подзадачи посчитаются как отдельные корни, поэтому значение приблизительное.'},

  {key: 'teamSize', label: 'Состав команды, человек', group: 'Команда', format: 'int', tip: 'Исполнители, давшие не меньше порога вклада от баллов периода. Разовые исполнители в состав не попадают — иначе размер команды завышается.'},
  {key: 'pointsPerPerson', label: 'Баллов на человека', group: 'Команда', format: 'one', tip: 'Баллы состава команды, поделённые на его размер. Числитель и знаменатель — по одному и тому же множеству людей.'},
  {key: 'tasksPerPerson', label: 'Задач на человека', group: 'Команда', format: 'one', tip: 'Закрытые задачи состава команды, поделённые на его размер.'},
];

export const DEFAULT_SETTINGS = {
  backlogStageIds: [],
  excludedStageIds: [],
  contributionThresholdPercent: 1,
  excludedUserIds: [],
  defaultMonths: 6,
  defaultCut: 'root',
  defaultCompareEnabled: true,
  defaultTab: 'summary',
  milestones: [],
  copySeparator: '\t',
  csvSeparator: ',',
};
