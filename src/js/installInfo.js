// Версия, с которой пользователь начал пользоваться расширением. Пишет её service worker
// (src/background/updates.js), читает попап — от неё зависит, какие опции считать новыми.
// Отдельный модуль, а не options.js: реестр фич тянет за собой все модули фич, а service worker'у
// нужен только ключ
export const INSTALLED_VERSION_STORAGE_KEY = 'installedVersion';
