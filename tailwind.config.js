import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './src/context/**/*.{js,ts,jsx,tsx,mdx}',
    // Add other specific paths if needed
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