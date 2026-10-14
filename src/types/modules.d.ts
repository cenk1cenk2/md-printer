declare module '*.svelte' {
  import type { Component } from 'svelte'

  const component: Component<any>

  export default component
}

declare module 'md-printer:template' {
  import type { Component } from 'svelte'

  const component: Component<any>

  export default component
}
