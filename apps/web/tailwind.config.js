const { join } = require('path');
const preset = require('@vms/ui/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    join(__dirname, 'src/**/*.{js,ts,jsx,tsx}'),
    join(__dirname, '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'),
  ],
};
