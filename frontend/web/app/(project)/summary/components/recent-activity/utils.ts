export function formatTimeAgo(dateString?: string) {
  if (!dateString) return '';

  const diff = new Date().getTime() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
