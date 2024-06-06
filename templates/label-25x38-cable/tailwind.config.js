const colors = require('theme-colors').getColors

/** @type {import("tailwindcss").Config} */
module.exports = {
  content: [ './template.html.j2' ],
  theme: {
    extend: {
      fontFamily: {
        sans: [ 'Montserrat' ],
        serif: [ 'Montserrat' ]
      },
      colors: {
        primary: colors('#cd0043')
      },
      typography: (theme) => ({
        css: {
          a: {
            color: theme('colors.primary.500'),
            textDecoration: 'none'
          },
          h1: {
            fontWeight: 700,
            paddingTop: theme('padding.0.75'),
            paddingBottom: theme('padding.0.75'),
            marginBottom: 0,
            marginTop: 0,
            borderWidth: 0
          },
          h2: {
            paddingTop: theme('padding.0.5'),
            paddingBottom: theme('padding.0.5'),
            marginBottom: 0,
            marginTop: 0,
            borderWidth: 0
          },
          h3: {
            paddingTop: theme('padding.0.25'),
            paddingBottom: theme('padding.0.25'),
            marginBottom: 0,
            marginTop: 0,
            borderWidth: 0
          },
          blockquote: {
            fontWeight: 400,
            color: theme('colors.gray.600'),
            fontStyle: 'normal',
            quotes: '"\\201C""\\201D""\\2018""\\2019"'
          },
          'blockquote p:first-of-type::before': {
            content: ''
          },
          'blockquote p:last-of-type::after': {
            content: ''
          },
          'ul > li': {
            paddingLeft: '1em',
            textAlign: 'left'
          },
          'ol > li': {
            paddingLeft: '1em',
            textAlign: 'left'
          },
          'ol > li::before': {
            top: 'calc(0.875em - 0.1em)'
          },
          'ul > li::before': {
            top: 'calc(0.875em - 0.1em)'
          }
        }
      })
    }
  },
  plugins: [ require('@tailwindcss/forms'), require('@tailwindcss/typography') ]
}
