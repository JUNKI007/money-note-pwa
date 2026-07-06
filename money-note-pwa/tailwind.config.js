/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-app': '#F5F7FA',
        'blue-main': '#6F8FAF',
        'blue-deep': '#3F5F7F',
        'card': '#FFFFFF',
        'text-primary': '#1F2933',
        'text-sub': '#6B7280',
        'income': '#2F9E73',
        'expense': '#D64545',
        'warning': '#F59E0B',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Pretendard"', '"Apple SD Gothic Neo"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
