export default function getGroupId(url = window.location.href) {
  if (!url.includes('/group/') || !url.includes('/tasks/')) return 0;

  const regex = /\/group\/(\d+?)\/tasks\/.*/i;

  return regex.exec(url)[1] || 0;
}
