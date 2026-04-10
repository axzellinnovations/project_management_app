export const BIO_MAX = 300;

export function formatRelativeTime(iso: string | null): string {
    if (!iso) return 'Never';
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export const inputCls = 'w-full rounded-lg border border-[#D0D5DD] bg-white text-[#101828] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
export const disabledCls = 'w-full rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] text-[#667085] px-4 py-2.5 text-sm';
export const labelCls = 'block text-sm font-medium text-[#344054] mb-1.5';
