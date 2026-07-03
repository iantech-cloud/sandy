import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        '13': 'repeat(13, minmax(0, 1fr))',
      },
      colors: {
        /* Design Token System - Africa-market optimized */
        /* Primary: Warm, earthy amber for trusted financial services */
        primary: '#b45309', /* amber-700: professional, warm, trustworthy */
        'primary-hover': '#92400e', /* amber-800 */
        'primary-light': '#fef08a', /* amber-100 for backgrounds */
        
        /* Neutral: Slightly warmed off-white and stone for personality */
        surface: '#f5f5f4', /* stone-50: warm off-white */
        'surface-muted': '#e7e5e4', /* stone-200 */
        
        /* Text: Deep charcoal for strong contrast */
        ink: '#292524', /* stone-900: very dark for readability */
        'ink-muted': '#78716c', /* stone-600: secondary text */
        
        /* Accent: Teal for CTAs and success states (sparingly) */
        accent: '#0d9488', /* teal-600 */
        'accent-light': '#ccfbf1', /* teal-100 */
        
        /* Semantic status colors (use ONLY for status) */
        success: '#15803d', /* green-700 */
        warning: '#ea580c', /* orange-600 */
        error: '#b91c1c', /* red-700 */
        info: '#0369a1', /* sky-700 */
        
        /* Legacy blue override for backward compatibility */
        blue: {
          400: '#2589FE',
          500: '#0070F3',
          600: '#2F6FEB',
        },
      },
      textColor: {
        DEFAULT: '#292524', /* ink: strong default text */
      },
      backgroundColor: {
        DEFAULT: '#ffffff', /* keep white default */
      },
    },
    keyframes: {
      shimmer: {
        '100%': {
          transform: 'translateX(100%)',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
export default config;
