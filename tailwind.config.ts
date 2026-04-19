/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        fraunces: ['Fraunces', 'serif'],
        jetbrains: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        'wb-ink':      '#0F1C2E',
        'wb-ink-soft': '#2B3A52',
        'wb-paper':    '#FAF6EF',
        'wb-paper-2':  '#F3EDE0',
        'wb-paper-3':  '#EAE2D0',
        'wb-line':     '#E6DDC9',
        'wb-sun':      '#F5A524',
        'wb-sunset':   '#E85D2F',
        'wb-coral':    '#FF6A5B',
        'wb-ocean':    '#0E6BA8',
        'wb-sky':      '#4FA3DF',
        'wb-forest':   '#1F6B4A',
        'wb-moss':     '#6B8F3E',
        'wb-plum':     '#6B3E7F',
      },
      boxShadow: {
        'wb-sm': '0 1px 0 rgba(15,28,46,0.04), 0 2px 6px rgba(15,28,46,0.06)',
        'wb-md': '0 2px 0 rgba(15,28,46,0.05), 0 10px 24px -8px rgba(15,28,46,0.14)',
        'wb-lg': '0 4px 0 rgba(15,28,46,0.05), 0 30px 50px -20px rgba(15,28,46,0.28)',
        'wb-sticker': '2px 2px 0 #0F1C2E',
        'wb-btn-primary': '3px 3px 0 #F5A524',
        'wb-btn-accent': '3px 3px 0 #0F1C2E',
      },
      borderRadius: {
        'wb': '10px',
        'wb-card': '16px',
        'wb-hero': '24px',
        'wb-modal': '20px',
      },
    },
  },
  plugins: [],
};
