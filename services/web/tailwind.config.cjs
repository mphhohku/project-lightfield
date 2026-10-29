module.exports = {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: { extend: { colors: { ink: '#171b19', moss: '#27332b', lime: '#b7f26a', parchment: '#f3f0e7' }, fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] } } },
  plugins: [require('@tailwindcss/forms')],
};
