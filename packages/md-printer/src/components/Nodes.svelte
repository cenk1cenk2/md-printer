<!--
  @component
  Resolved markdown: HTML as is, directives as the components registered for them, and the elements around a directive as elements.
-->
<script>
  import { getContext } from 'svelte'

  // eslint-disable-next-line import/no-self-import -- a Svelte 5 component recurses by importing itself
  import Nodes from './Nodes.svelte'

  /** @type {{ nodes: import('../interfaces/markdown.interface.js').MarkdownNode[] }} */
  let { nodes } = $props()

  /** @type {Record<string, import('svelte').Component<any>>} */
  const components = getContext('md-printer:components')
</script>

{#each nodes as node, index (index)}
  {#if node.type === 'html'}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- markdown input is trusted, same as the document itself -->
    {@html node.html}
  {:else if node.type === 'element'}
    <svelte:element this={node.tag} {...node.attributes}><Nodes nodes={node.children} /></svelte:element>
  {:else}
    {@const Component = components[node.name]}
    {#if node.children.length}
      <Component {...node.props}><Nodes nodes={node.children} /></Component>
    {:else}
      <Component {...node.props} />
    {/if}
  {/if}
{/each}
