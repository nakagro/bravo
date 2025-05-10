const { } = require('tailwindcss/defaultTheme');

module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {
      colors: {
        // Define custom colors that work well in both light and dark modes
        primary: {
          light: '#ef4444', // red-500
          dark: '#f87171',  // red-400 (slightly lighter for dark mode)
        },
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};