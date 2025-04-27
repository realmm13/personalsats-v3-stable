import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './src/**/*.{js,jsx,ts,tsx,html}',
    './app/**/*.{js,ts,tsx,mdx}',
    // add any other globs (e.g. pages/, components/)
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f5faff',
          100: '#e6f3ff',
          500: '#3b82f6',
          700: '#1e3a8a',
        },
      },
      // fonts, spacing, etc.
    },
  },
  plugins: [
    tailwindcssAnimate,
    // any other plugins you installed
  ],
};

export default config; 