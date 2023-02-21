const postcssGlobalData = require('@csstools/postcss-global-data')

module.exports = {
  plugins: [
    require('postcss-import'),
    require('tailwindcss/nesting'),
    require('tailwindcss'),
    postcssGlobalData({
      files: ['node_modules/@oxide/design-system/styles/dist/main.css'],
    }),
    require('postcss-custom-properties'),
    require('./postcss/postcss-wide-gamut-color/index.cjs'),
    // use `npx autoprefixer --info` to see autoprefixer debug inf
    require('autoprefixer'),
  ],
}
