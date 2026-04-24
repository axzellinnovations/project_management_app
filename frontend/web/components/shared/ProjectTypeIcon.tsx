interface ProjectTypeIconProps {
  projectType?: string | null;
  size?: number;
  className?: string;
  stroke?: string;
  strokeWidth?: number;
  animated?: boolean;
}

const normalizeProjectType = (projectType?: string | null) => {
  return (projectType || '')
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
};

export const isAgileProjectType = (projectType?: string | null) => {
  const normalizedType = normalizeProjectType(projectType);
  return normalizedType.includes('AGILE') || normalizedType.includes('SCRUM');
};

export function ProjectTypeIcon({
  projectType,
  size = 14,
  className = '',
  stroke = 'currentColor',
  strokeWidth = 2.5,
  animated = false,
}: ProjectTypeIconProps) {
  const iconClassName = [className, animated && isAgileProjectType(projectType) ? 'topbar-agile-loop' : '']
    .filter(Boolean)
    .join(' ');

  if (isAgileProjectType(projectType)) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClassName}
      >
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
      </svg>
    );
  }

  if (animated) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" className="opacity-30" />
        <line x1="8" y1="16" x2="8" y2="7">
          <animate attributeName="y1" values="16;13;16" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="y2" values="7;10;7" dur="1.8s" repeatCount="indefinite" />
        </line>
        <line x1="16" y1="13" x2="16" y2="7">
          <animate attributeName="y1" values="13;16;13" dur="1.8s" begin="0.45s" repeatCount="indefinite" />
          <animate attributeName="y2" values="7;9;7" dur="1.8s" begin="0.45s" repeatCount="indefinite" />
        </line>
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClassName}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" className="opacity-30" />
      <path d="M8 7v9" />
      <path d="M16 7v6" />
    </svg>
  );
}