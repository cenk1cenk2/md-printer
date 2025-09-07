import prettierrc from '@cenk1cenk2/eslint-config/prettierrc'

/** @type {import("prettier").Config} */
export default {
  ...prettierrc,
  plugins: ['prettier-plugin-jinja-template'],
  overrides: [
    {
      files: ['template.html.j2'],
      options: {
        parser: 'jinja-template'
      }
    }
  ]
}
