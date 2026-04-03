import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cu: {
          primary: '#7B68EE',
          'primary-hover': '#6C5CE7',
          'primary-dark': '#5A4BD1',
          'primary-light': '#E8E5FF',
          'primary-muted': '#A29BFE',
          purple: '#7B68EE',
          'purple-hover': '#6C5CE7',
          'purple-light': '#E8E5FF',
          'purple-muted': '#A29BFE',
          sidebar: '#1A1A2E',
          'sidebar-hover': '#252543',
          'sidebar-active': '#2D2D50',
          'sidebar-border': '#32325D',
          'sidebar-text': '#A0A0B8',
          'sidebar-text-bright': '#E0E0F0',
          success: '#6BC950',
          'success-light': '#E6F9E0',
          warning: '#FF9F43',
          'warning-light': '#FFF3E0',
          danger: '#FF5C5C',
          'danger-light': '#FFE5E5',
          info: '#4299E1',
          'info-light': '#E3F2FD',
          bg: '#FFFFFF',
          'bg-secondary': '#F7F8FA',
          'bg-tertiary': '#F0F1F3',
          hover: '#F5F7FA',
          border: '#E8E8ED',
          'border-light': '#F0F0F5',
          'text-primary': '#1A1A2E',
          'text-secondary': '#6B6F7B',
          'text-tertiary': '#9CA3AF',
          'text-muted': '#B0B8C4',
        },
        status: {
          todo: '#D3D3D3',
          'in-progress': '#7B68EE',
          'in-review': '#FF9F43',
          done: '#6BC950',
        },
        priority: {
          urgent: '#FF5C5C',
          high: '#FF9F43',
          normal: '#7B68EE',
          low: '#D3D3D3',
        },
      },
      fontFamily: {
        inter: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],       // 11px
        xs: ['0.75rem', { lineHeight: '1.125rem' }],         // 12px
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],        // 13px
        base: ['0.875rem', { lineHeight: '1.375rem' }],      // 14px
        md: ['1rem', { lineHeight: '1.5rem' }],              // 16px
        lg: ['1.125rem', { lineHeight: '1.625rem' }],        // 18px
        xl: ['1.25rem', { lineHeight: '1.75rem' }],          // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],           // 24px
      },
      spacing: {
        '4.5': '1.125rem',  // 18px
        '13': '3.25rem',    // 52px
        '15': '3.75rem',    // 60px
        '18': '4.5rem',     // 72px
        'sidebar': '240px',
        'sidebar-collapsed': '56px',
        'topbar': '48px',
        'detail-panel': '400px',
      },
      borderRadius: {
        'cu-sm': '4px',
        'cu-md': '6px',
        'cu-lg': '8px',
        'cu-xl': '12px',
        'cu-2xl': '16px',
      },
      boxShadow: {
        'cu-sm': '0 1px 2px rgba(0, 0, 0, 0.06)',
        'cu-md': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'cu-lg': '0 8px 24px rgba(0, 0, 0, 0.12)',
        'cu-xl': '0 16px 48px rgba(0, 0, 0, 0.16)',
      },
      width: {
        'sidebar': '240px',
        'sidebar-collapsed': '56px',
        'detail-panel': '400px',
      },
      minWidth: {
        'sidebar': '240px',
        'sidebar-collapsed': '56px',
      },
      maxWidth: {
        'sidebar': '240px',
      },
      transitionDuration: {
        'fast': '100ms',
        'normal': '200ms',
        'slow': '300ms',
      },
      animation: {
        'shimmer': 'shimmer 1.5s infinite linear',
        'slide-up': 'slideUp 200ms ease-out',
        'slide-in-right': 'slideInRight 200ms ease-out',
        'fade-in': 'fadeIn 150ms ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [
    typography,
  ],
};

export default config;
