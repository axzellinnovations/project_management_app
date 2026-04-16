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

export const inputCls = 'h-10 w-full rounded-xl border border-[#D0D5DD] bg-white text-[#101828] px-3.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 focus:border-[#155DFC]';
export const disabledCls = 'h-10 w-full rounded-xl border border-[#D0D5DD] bg-[#F9FAFB] text-[#667085] px-3.5 text-sm';
export const labelCls = 'mb-1.5 block text-[13px] font-semibold text-[#344054]';
