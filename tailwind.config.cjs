/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tight: '-0.01em',
        normal: '0',
        wide: '0.025em',
        wider: '0.05em',
        widest: '0.1em',
      },
      transitionDuration: {
        '150': '150ms',
      },
      transitionTimingFunction: {
        'out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
      colors: {
        surface: {
          0: '#0c0c0e',
          1: '#131316',
          2: '#1a1a1f',
          3: '#222228',
          4: '#2a2a32',
        },
        accent: {
          blue: '#6C8EEF',
          purple: '#A78BFA',
          rose: '#F472B6',
          emerald: '#34D399',
          amber: '#FBBF24',
          orange: '#FB923C',
          teal: '#2DD4BF',
          red: '#F87171',
        },
        muted: '#6b6b7b',
        subtle: '#3a3a46',
      },
      animation: {
        'check-pop': 'checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'fade-in-slow': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in-bounce': 'scaleInBounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'ring-fill': 'ringFill 0.8s ease-out forwards',
        'voice-pulse': 'voicePulse 1.5s ease-in-out infinite',
        'speak-wave': 'speakWave 1s ease-in-out infinite',
        'overlay-in': 'overlaySlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease-in-out infinite',
        'tab-indicator': 'tabIndicator 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'celebrate': 'celebrate 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'glow-ring': 'glowRing 0.6s ease-out forwards',
        'breathe': 'breathe 3s ease-in-out infinite',
        'stagger-in': 'staggerIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fab-pulse': 'fabPulse 3s ease-in-out infinite',
        'border-glow': 'borderGlow 2s ease-in-out infinite',
      },
      keyframes: {
        checkPop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleInBounce: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '60%': { transform: 'scale(1.03)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.6', filter: 'brightness(1)' },
          '50%': { opacity: '1', filter: 'brightness(1.2)' },
        },
        voicePulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(244, 114, 182, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(244, 114, 182, 0)' },
        },
        ringFill: {
          '0%': { strokeDashoffset: '251' },
          '100%': { strokeDashoffset: 'var(--ring-offset)' },
        },
        speakWave: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
        overlaySlideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        tabIndicator: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        celebrate: {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(52, 211, 153, 0.4)' },
          '50%': { transform: 'scale(1.02)', boxShadow: '0 0 20px 4px rgba(52, 211, 153, 0.15)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(52, 211, 153, 0)' },
        },
        glowRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(108, 142, 239, 0.4)', opacity: '0.5' },
          '50%': { boxShadow: '0 0 0 6px rgba(108, 142, 239, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(108, 142, 239, 0)', opacity: '1' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        staggerIn: {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        fabPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(108, 142, 239, 0.3), 0 4px 12px rgba(0,0,0,0.3)' },
          '50%': { boxShadow: '0 0 0 8px rgba(108, 142, 239, 0), 0 8px 24px rgba(0,0,0,0.4)' },
        },
        borderGlow: {
          '0%, 100%': { borderColor: 'rgba(255, 255, 255, 0.04)' },
          '50%': { borderColor: 'rgba(255, 255, 255, 0.08)' },
        },
      },
    },
  },
  plugins: [],
}
