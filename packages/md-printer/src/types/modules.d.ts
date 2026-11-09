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

declare module 'md-printer:template-components' {
  import type { Component } from 'svelte'

  const components: Record<string, Component<any>>

  export default components
}

declare module 'md-printer:extension' {
  /** The namespaces of the extension modules in order. */
  const modules: Record<string, unknown>[]

  export default modules
}

declare module '*.svg' {
  const uri: string

  export default uri
}
