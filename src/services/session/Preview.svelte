<!--
  @component
  Shell page of the live preview: the HTML and the printed PDF side by side, updated over server-sent events.
-->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>md-printer preview</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #f4f4f5;
        --panel: #ffffff;
        --text: #18181b;
        --muted: #71717a;
        --accent: #cd0043;
        --border: #e4e4e7;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #17191e;
          --panel: #22282f;
          --text: #e4e4e7;
          --muted: #979eab;
          --border: #2c333d;
        }
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        height: 100vh;
        display: grid;
        grid-template-rows: auto 1fr;
        font:
          13px system-ui,
          sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        background: var(--panel);
        border-bottom: 1px solid var(--border);
      }
      header strong {
        margin-right: auto;
      }
      nav button {
        padding: 4px 12px;
        border: 1px solid var(--border);
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
      nav button:first-child {
        border-radius: 6px 0 0 6px;
      }
      nav button:last-child {
        border-radius: 0 6px 6px 0;
      }
      nav button[aria-pressed='true'] {
        background: var(--text);
        color: var(--bg);
      }
      #status {
        color: var(--muted);
        font-variant-numeric: tabular-nums;
      }
      #badge {
        display: none;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--accent);
        color: #fff;
        font-weight: 600;
      }
      main {
        display: grid;
        gap: 1px;
        background: var(--border);
        min-height: 0;
      }
      main[data-view='html'] #pdf,
      main[data-view='pdf'] #html {
        display: none;
      }
      main[data-view='split'] {
        grid-template-columns: 1fr 1fr;
      }
      section {
        position: relative;
        min-height: 0;
        background: var(--panel);
      }
      iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
        background: #fff;
      }
      iframe[hidden] {
        visibility: hidden;
      }
      #overlay {
        display: none;
        position: fixed;
        inset: 48px 16px auto;
        max-height: 70vh;
        overflow: auto;
        padding: 16px;
        border-left: 4px solid var(--accent);
        border-radius: 8px;
        background: var(--panel);
        box-shadow: 0 8px 32px rgb(0 0 0 / 30%);
        white-space: pre-wrap;
        font:
          12px ui-monospace,
          monospace;
      }
      @media (max-width: 900px) {
        main[data-view='split'] {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <strong>md-printer preview</strong>
      <span id="badge">unsigned preview</span>
      <span id="status">connecting</span>
      <nav>
        <button data-view="html">HTML</button><button data-view="split">Split</button><button data-view="pdf">PDF</button>
      </nav>
    </header>
    <main data-view="split">
      <section id="html"><iframe title="HTML"></iframe><iframe title="HTML" hidden></iframe></section>
      <section id="pdf"><iframe title="PDF"></iframe></section>
    </main>
    <pre id="overlay"></pre>
    <script>
      const main = document.querySelector('main')
      const status = document.getElementById('status')
      const badge = document.getElementById('badge')
      const overlay = document.getElementById('overlay')
      const pdf = document.querySelector('#pdf iframe')
      let [visible, buffer] = document.querySelectorAll('#html iframe')
      let pdfOutput = true

      const setView = (view) => {
        main.dataset.view = pdfOutput ? view : 'html'
        for (const button of document.querySelectorAll('nav button')) {
          button.setAttribute('aria-pressed', String(button.dataset.view === main.dataset.view))
        }
        try {
          localStorage.setItem('md-printer:view', view)
        } catch {}
      }

      for (const button of document.querySelectorAll('nav button')) {
        button.addEventListener('click', () => setView(button.dataset.view))
      }

      const currentPage = () => {
        const doc = visible.contentDocument?.documentElement
        const pages = Number(pdf.dataset.pages || 1)

        if (!doc || doc.scrollHeight <= doc.clientHeight) {
          return 1
        }

        return Math.min(pages, Math.floor((doc.scrollTop / doc.scrollHeight) * pages) + 1)
      }

      const reloadHtml = (version) => {
        const scroll = visible.contentDocument?.documentElement.scrollTop ?? 0

        buffer.onload = () => {
          buffer.contentDocument.documentElement.scrollTop = scroll
          buffer.hidden = false
          visible.hidden = true
          ;[visible, buffer] = [buffer, visible]
        }
        buffer.src = `/document.html?v=${version}`
      }

      const events = new EventSource('/__events')

      events.addEventListener('building', () => {
        status.textContent = 'building'
      })

      events.addEventListener('ready', ({ data }) => {
        const build = JSON.parse(data)

        overlay.style.display = 'none'
        status.textContent = `v${build.version}, ${build.pages ? `${build.pages} pages, ` : ''}${build.ms}ms`
        badge.style.display = build.signed ? 'inline' : 'none'
        pdfOutput = build.pdf

        reloadHtml(build.version)

        if (build.pdf) {
          pdf.dataset.pages = build.pages
          pdf.src = `/document.pdf?v=${build.version}#page=${currentPage()}`
        }

        setView(main.dataset.view)
      })

      events.addEventListener('failed', ({ data }) => {
        const error = JSON.parse(data)

        status.textContent = 'failed'
        overlay.textContent = [error.file, error.message, error.frame].filter(Boolean).join('\n\n')
        overlay.style.display = 'block'
      })

      events.addEventListener('error', () => {
        status.textContent = 'disconnected'
      })

      let stored
      try {
        stored = localStorage.getItem('md-printer:view')
      } catch {}
      setView(stored ?? (window.innerWidth > 900 ? 'split' : 'pdf'))
    </script>
  </body>
</html>
