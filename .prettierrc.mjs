import prettierrc from '@cenk1cenk2/eslint-config/prettierrc'

/** @type {import("prettier").Config} */
export default {
  ...prettierrc,
  plugins: ['prettier-plugin-svelte'],
  overrides: [
    {
      files: ['*.svelte'],
      options: {
        parser: 'svelte'
      }
    }
  ]
}
