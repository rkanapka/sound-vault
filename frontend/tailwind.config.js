/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#f8f8f7',
          100: '#f0f0f0',
          200: '#e0e2e0',
          300: '#c9cac4',
          400: '#b4b4b4',
          500: '#9d9e97',
          600: '#777972',
          700: '#374336',
          800: '#595957',
          900: '#111110',
          950: '#090909',
        },
        emerald: {
          50: '#f8f8f7',
          100: '#f0f0f0',
          200: '#e8e9e7',
          300: '#e0e2e0',
          400: '#e0e2e0',
          500: '#c2c3bd',
          600: '#9d9e97',
          700: '#7f8079',
          800: '#686963',
          900: '#3b3d38',
        },
      },
    },
  },
  plugins: [],
}
