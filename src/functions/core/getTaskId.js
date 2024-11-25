export default function getTaskId(url = window.location.href) {
  if (!url.includes('/tasks/task/view/')) return 0;

  const regex = /\/tasks\/task\/view\/(\d+?)\/.*/i;

  return regex.exec(url)[1] || 0;
}
