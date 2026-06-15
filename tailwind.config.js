import animate from 'tailwindcss-animate';

/**
 * The Frame — warm/comfy LIGHT design system.
 *
 * Deliberate exception to random-tools' dark/terminal universal style rules
 * (see CLAUDE.md). Tokens live in src/styles.scss as HSL CSS variables; this
 * config consumes them. The scale here is rem-based and relaxed — tuned for a
 * cozy, native mobile feel, NOT random-tools' em/4px-grid contract.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      fontFamily: {
        // Soft serif for warmth in headings, rounded sans for friendly body copy.
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Nunito', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.55' }],
        base: ['1rem', { lineHeight: '1.6' }],
        lg: ['1.125rem', { lineHeight: '1.55' }],
        xl: ['1.25rem', { lineHeight: '1.45' }],
        '2xl': ['1.5rem', { lineHeight: '1.35' }],
        '3xl': ['1.875rem', { lineHeight: '1.25' }],
        '4xl': ['2.375rem', { lineHeight: '1.15' }],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      boxShadow: {
        // Warm-tinted (espresso, not gray) elevation for a soft, tactile feel.
        soft: '0 1px 2px hsl(28 28% 22% / 0.05), 0 2px 8px hsl(28 28% 22% / 0.06)',
        card: '0 2px 4px hsl(28 28% 22% / 0.05), 0 8px 24px hsl(28 28% 22% / 0.08)',
        lifted: '0 8px 16px hsl(28 28% 22% / 0.08), 0 16px 40px hsl(28 28% 22% / 0.12)',
      },
    },
  },
  plugins: [animate],
};
