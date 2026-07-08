import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Couleurs de marque (constantes) — extraites du logo Odalyan
        brand: {
          coral: 'var(--brand-coral)',
          rose: 'var(--brand-rose)',
          magenta: 'var(--brand-magenta)',
          violet: 'var(--brand-violet)',
          'violet-deep': 'var(--brand-violet-deep)',
          blue: 'var(--brand-blue)',
        },
        // Tokens sémantiques (changent selon le thème)
        bg: 'var(--bg)',
        'bg-soft': 'var(--bg-soft)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-hover': 'var(--surface-hover)',
        sidebar: 'var(--sidebar)',
        border: 'var(--border)',
        content: 'var(--text)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient':
          'linear-gradient(135deg, var(--brand-coral), var(--brand-rose), var(--brand-violet))',
        'brand-violet-magenta':
          'linear-gradient(135deg, var(--brand-violet), var(--brand-magenta))',
        'cosmic-gradient':
          'radial-gradient(circle at 15% 15%, rgba(124,58,237,0.22), transparent 40%), radial-gradient(circle at 85% 20%, rgba(59,130,246,0.16), transparent 45%), radial-gradient(circle at 50% 95%, rgba(232,82,122,0.16), transparent 50%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        kenburns: {
          '0%': { transform: 'scale(1.02) translateY(0)' },
          '100%': { transform: 'scale(1.14) translateY(-2.5%)' },
        },
        runwayIn: {
          '0%': { opacity: '0', transform: 'scale(1.06)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        kenburns: 'kenburns 5s ease-in-out infinite alternate',
        runwayIn: 'runwayIn 0.7s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
