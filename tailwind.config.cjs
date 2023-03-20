// @ts-check

/** @type {import('tailwindcss/lib/util/createPlugin').default} */
// @ts-ignore
const plugin = require('tailwindcss/plugin')
const {
  textUtilities,
  colorUtilities,
  borderRadiusTokens,
} = require('@oxide/design-system/styles/dist/tailwind-tokens')

/** @type {import('tailwindcss/tailwind-config').TailwindConfig} */
module.exports = {
  corePlugins: {
    fontFamily: false,
    fontSize: true,
  },
  content: [
    './src/**/*.{ts,tsx}',
    process.env.NODE_ENV === 'production'
      ? '../templates/*.jsx'
      : './starter/main/templates/*.jsx',
  ],
  theme: {
    borderRadius: {
      ...borderRadiusTokens,
    },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
    },
  },
  plugins: [
    plugin(({ addUtilities, addVariant }) => {
      addUtilities(textUtilities)
      addUtilities(colorUtilities)
      addVariant('children', '& > *')
    }),
  ],
}
