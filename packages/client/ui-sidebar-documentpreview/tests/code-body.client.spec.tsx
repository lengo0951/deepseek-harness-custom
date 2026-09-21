// @vitest-environment jsdom
/** Accumulated document rendering through the real streaming CodeBlock. */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { absoluteFileAddress, sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import { CodeBody } from '../src/client/code/CodeBody.tsx'
import type { CodeBodyProps } from '../src/client/code/CodeBody.tsx'
import type { DocumentContent } from '../src/client/document/contract.ts'
import { en, zh } from '../src/client/code/locales.ts'
import css from '../src/client/code/CodeBody.module.css'
import primitiveCss from '../../ui-primitives/src/markdown/CodeBlock.module.css'

const SESSION = 'code-preview' as SessionId
let stylesheet: HTMLStyleElement | undefined

afterEach(() => {
  try {
    cleanup()
  } finally {
    stylesheet?.remove()
    stylesheet = undefined
  }
})

function contents(pages: readonly string[], eof = false): DocumentContent {
  let offset = 1
  return {
    kind: 'text', text: pages.join('\n'), eof,
    pages: pages.map((text) => {
      const page = { offset, text, lines: text.split('\n').length }
      offset += page.lines
      return page
    }),
  }
}

/** Unused framework seats are omitted; this renderer reads only owner data and t. */
function props(content: DocumentContent, overrides: Partial<CodeBodyProps> = {}): CodeBodyProps {
  return {
    resourceAddress: sessionFileAddress(SESSION, 'source.ts'), sessionId: SESSION,
    content, wrap: false, t: (key: keyof typeof en) => en[key], ...overrides,
  } as CodeBodyProps
}

function element(root: HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(`missing ${selector}`)
  return found
}

function tokens(root: HTMLElement) {
  return [...root.querySelectorAll('.shiki .line')].map(line =>
    [...line.querySelectorAll<HTMLElement>('span[style]')].map(span => [span.textContent, span.style.color]))
}

/** Apply both source stylesheets using Vite's module names; jsdom has no CSS loader. */
function installStyles(): void {
  const directory = dirname(fileURLToPath(import.meta.url))
  const own = readFileSync(resolve(directory, '../src/client/code/CodeBody.module.css'), 'utf8')
    .replaceAll('.renderer', `.${css.renderer}`).replaceAll('.code', `.${css.code}`)
  const shared = readFileSync(resolve(directory, '../../ui-primitives/src/markdown/CodeBlock.module.css'), 'utf8')
    .replaceAll('.block', `.${primitiveCss.block}`)
    .replaceAll('.content', `.${primitiveCss.content}`)
  stylesheet = document.createElement('style')
  // The shared defaults load last to prove the renderer's selectors override them.
  stylesheet.textContent = `${own}\n${shared}`
  document.head.append(stylesheet)
}

describe('CodeBody', () => {
  it('rejects a malformed file address without starting the highlighter', () => {
    expect(() => CodeBody(props(contents(['plain'], true), { resourceAddress: 'not-a-file-address' }))).toThrow('not a file address')
  })

  it.each([
    [sessionFileAddress(SESSION, 'src/space # question?.TS'), 'typescript'],
    [absoluteFileAddress('C:/project/module.MJS'), 'javascript'],
  ])('selects language from the decoded file address %s', (resourceAddress, language) => {
    const view = render(<CodeBody {...props(contents(['const answer = 42'], true), { resourceAddress })} />)
    expect(view.getByText(language, { exact: true })).toBeTruthy()
    expect(element(view.container, '.shiki').textContent).toBe('const answer = 42')
    expect(view.container.querySelector('[data-line-numbers]')).not.toBeNull()
    expect(view.getByRole('button', { name: 'Copy' })).toBeTruthy()
  })

  it('carries multiline grammar state across pages and preserves completed lines through settlement', () => {
    const first = 'const before = 1;\n/* open comment'
    const next = 'still a comment\n*/\nconst after = 2;'
    const view = render(<CodeBody {...props(contents([first]))} />)
    const pre = element(view.container, '.shiki')
    const firstLine = element(pre, '.line')
    const copy = view.getByRole('button', { name: 'Copy' })
    view.rerender(<CodeBody {...props(contents([first, next]))} />)
    expect(view.container.querySelectorAll('.md-code-block')).toHaveLength(1)
    expect(element(view.container, '.shiki')).toBe(pre)
    expect(element(pre, '.line')).toBe(firstLine)
    expect(pre.querySelectorAll('.line')).toHaveLength(5)
    expect(view.container.querySelector('[data-line-numbers]')).not.toBeNull()
    const continuation = pre.querySelectorAll('.line').item(2)
    expect(continuation.textContent).toBe('still a comment')
    expect(element(continuation as HTMLElement, 'span').style.color).toBe('var(--shiki-token-comment)')
    expect(pre.textContent).toBe(`${first}\n${next}`)
    view.rerender(<CodeBody {...props(contents([first, next], true))} />)
    expect(element(view.container, '.shiki')).toBe(pre)
    expect(element(pre, '.line')).toBe(firstLine)
    expect(view.getByRole('button', { name: 'Copy' })).toBe(copy)
    const settled = render(<CodeBody {...props(contents([first, next], true))} />)
    expect(tokens(view.container)).toEqual(tokens(settled.container))
  })

  it('highlights the complete source when the last page also reports eof', () => {
    const first = 'const text = `first'
    const last = 'second`;\nconst count = 2;'
    const view = render(<CodeBody {...props(contents([first]))} />)
    const copy = view.getByRole('button', { name: 'Copy' })
    view.rerender(<CodeBody {...props(contents([first, last], true))} />)
    expect(view.container.querySelectorAll('.md-code-block')).toHaveLength(1)
    expect(view.getByRole('button', { name: 'Copy' })).toBe(copy)
    const settled = render(<CodeBody {...props(contents([first, last], true))} />)
    expect(tokens(view.container)).toEqual(tokens(settled.container))
    expect(element(view.container, '.shiki').textContent).toBe(`${first}\n${last}`)
  })

  it('picks up a lazily loaded grammar without losing the source text', async () => {
    const code = 'def answer():\n    return 42'
    const view = render(<CodeBody {...props(contents([code], true), { resourceAddress: sessionFileAddress(SESSION, 'answer.py') })} />)
    expect(element(view.container, 'pre').textContent).toBe(code)
    await waitFor(() => { expect(view.container.querySelector('.shiki')).not.toBeNull() })
    expect(element(view.container, '.shiki').textContent).toBe(code)
    expect(view.container.querySelectorAll('.shiki span[style]').length).toBeGreaterThan(1)
  })

  it.each([['html', '<h1>Source only</h1>'], ['md', '# Source only']])('renders %s as selectable source, not document markup', async (extension, code) => {
    const view = render(<CodeBody {...props(contents([code], true), { resourceAddress: sessionFileAddress(SESSION, `page.${extension}`) })} />)
    await waitFor(() => { expect(view.container.querySelector('.shiki')).not.toBeNull() })
    expect(element(view.container, '.shiki').textContent).toBe(code)
    expect(view.container.querySelector('h1')).toBeNull()
  })

  it('passes localized controls and ignores byte contents outside its loading mode', () => {
    const view = render(<CodeBody {...props(contents(['const a = 1'], true), { t: key => zh[key as keyof typeof zh] })} />)
    expect(view.getByRole('button', { name: '复制' })).toBeTruthy()
    view.rerender(<CodeBody {...props({ kind: 'bytes', data: new TextEncoder().encode('a') })} />)
    expect(view.container.querySelector('.md-code-block')).toBeNull()
  })

  it('keeps a stable inner scrollport while switching wrapping without remounting the highlighter', () => {
    installStyles()
    const code = `const identifier = "${'x'.repeat(300)}";`
    const content = contents([code])
    const view = render(<CodeBody {...props(content)} />)
    const pre = element(view.container, '.shiki')
    const block = element(view.container, '.md-code-block')
    const scrollport = element(view.container, '[data-code-block-content]')
    expect(getComputedStyle(block).marginTop).toBe('0px')
    expect(getComputedStyle(block).position).toBe('static')
    expect(getComputedStyle(element(view.container, '[data-code-preview]')).height).toBe('100%')
    expect(getComputedStyle(scrollport).display).toBe('block')
    expect(getComputedStyle(scrollport).overflow).toBe('auto')
    expect(getComputedStyle(pre).whiteSpace).toBe('pre')
    expect(getComputedStyle(pre).overflow).toBe('visible')
    expect(getComputedStyle(pre).wordBreak).toBe('normal')
    view.rerender(<CodeBody {...props(content, { wrap: true })} />)
    expect(element(view.container, '.shiki')).toBe(pre)
    expect(element(view.container, '[data-code-block-content]')).toBe(scrollport)
    expect(getComputedStyle(pre).whiteSpace).toBe('pre-wrap')
    expect(getComputedStyle(pre).overflowWrap).toBe('anywhere')
    expect(getComputedStyle(pre).overflow).toBe('visible')
    expect(pre.textContent).toBe(code)
    view.rerender(<CodeBody {...props(content)} />)
    expect(getComputedStyle(pre).whiteSpace).toBe('pre')
    expect(getComputedStyle(pre).overflowWrap).toBe('normal')
  })

  it('renders editor status bar with line stats, language, and line selection', () => {
    const code = 'const first = 1\nconst second = 2\nconst third = 3'
    const view = render(<CodeBody {...props(contents([code], true))} />)
    expect(view.getByText('3 lines')).toBeTruthy()
    expect(view.getByText('TYPESCRIPT')).toBeTruthy()
    expect(view.getByText('Ln 1')).toBeTruthy()

    // Click on line 2
    const lines = view.container.querySelectorAll('.shiki .line')
    expect(lines.length).toBe(3)
    fireEvent.click(lines[1]!)
    expect(view.getByText('Ln 2')).toBeTruthy()
  })

  it('toggles find in file toolbar and navigates matches', () => {
    const code = 'function foo() {\n  const foo = 1\n  return foo\n}'
    const view = render(<CodeBody {...props(contents([code], true))} />)

    // Open find bar via button
    const findButtons = view.getAllByTitle('Find')
    expect(findButtons.length).toBeGreaterThan(0)
    fireEvent.click(findButtons[0]!)

    const input = view.getByPlaceholderText('Find in file…') as HTMLInputElement
    expect(input).toBeTruthy()

    // Toggle off via the same button
    fireEvent.click(findButtons[0]!)
    expect(view.queryByPlaceholderText('Find in file…')).toBeNull()

    // Reopen via button
    fireEvent.click(findButtons[0]!)
    const input2 = view.getByPlaceholderText('Find in file…') as HTMLInputElement

    // Type query matching 'foo'
    fireEvent.change(input2, { target: { value: 'foo' } })
    expect(view.getByText('1/3')).toBeTruthy()

    // Navigate to next match
    const nextBtn = view.getByTitle('Next match')
    fireEvent.click(nextBtn)
    expect(view.getByText('2/3')).toBeTruthy()

    // Navigate to previous match
    const prevBtn = view.getByTitle('Previous match')
    fireEvent.click(prevBtn)
    expect(view.getByText('1/3')).toBeTruthy()

    // Close via close button
    const closeBtn = view.getByTitle('Close')
    fireEvent.click(closeBtn)
    expect(view.queryByPlaceholderText('Find in file…')).toBeNull()
  })

  it('opens and submits go-to-line dialog', () => {
    const code = 'line 1\nline 2\nline 3\nline 4\nline 5'
    const view = render(<CodeBody {...props(contents([code], true))} />)

    const goToLineButtons = view.getAllByTitle('Go to Line')
    expect(goToLineButtons.length).toBeGreaterThan(0)
    fireEvent.click(goToLineButtons[0]!)

    const input = view.getByPlaceholderText('Line number…') as HTMLInputElement
    expect(input).toBeTruthy()

    // Toggle off via button
    fireEvent.click(goToLineButtons[0]!)
    expect(view.queryByPlaceholderText('Line number…')).toBeNull()

    // Reopen
    fireEvent.click(goToLineButtons[0]!)
    const input2 = view.getByPlaceholderText('Line number…') as HTMLInputElement

    fireEvent.change(input2, { target: { value: '4' } })
    const goBtn = view.getByRole('button', { name: 'Go' })
    fireEvent.click(goBtn)

    expect(view.queryByPlaceholderText('Line number…')).toBeNull()
    expect(view.getByText('Ln 4')).toBeTruthy()
  })

  it('supports keyboard shortcuts, navigation keys, and close actions', () => {
    const code = 'abc\ndef\nabc'
    const scrollportFn = vi.fn()
    const view = render(<CodeBody {...props(contents([code], true), { scrollportRef: scrollportFn })} />)
    expect(scrollportFn).toHaveBeenCalled()

    // Test Cmd+F
    fireEvent.keyDown(window, { key: 'f', metaKey: true })
    const input = view.getByPlaceholderText('Find in file…') as HTMLInputElement
    expect(input).toBeTruthy()

    // Type query with no matches
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(view.getByText('No matches')).toBeTruthy()

    // Type empty query
    fireEvent.change(input, { target: { value: '' } })

    // Type matching query
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(view.getByText('1/2')).toBeTruthy()

    // Regular key (Tab) doesn't navigate or close
    fireEvent.keyDown(input, { key: 'Tab' })

    // Enter for next match
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(view.getByText('2/2')).toBeTruthy()

    // Shift+Enter for previous match
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(view.getByText('1/2')).toBeTruthy()

    // Escape closes find bar
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(view.queryByPlaceholderText('Find in file…')).toBeNull()

    // Other key on window does not trigger actions
    fireEvent.keyDown(window, { key: 'z', metaKey: true })

    // Test Ctrl+G
    fireEvent.keyDown(window, { key: 'g', ctrlKey: true })
    const lineInput = view.getByPlaceholderText('Line number…') as HTMLInputElement
    expect(lineInput).toBeTruthy()

    // Regular key (Tab) doesn't close
    fireEvent.keyDown(lineInput, { key: 'Tab' })

    // Close button on go-to-line
    const closeBtns = view.getAllByTitle('Close')
    fireEvent.click(closeBtns[0]!)
    expect(view.queryByPlaceholderText('Line number…')).toBeNull()

    // Reopen go-to-line and close via Escape
    fireEvent.keyDown(window, { key: 'g', metaKey: true })
    const lineInput2 = view.getByPlaceholderText('Line number…') as HTMLInputElement
    fireEvent.keyDown(lineInput2, { key: 'Escape' })
    expect(view.queryByPlaceholderText('Line number…')).toBeNull()

    // Submit with empty value does not throw or change
    fireEvent.keyDown(window, { key: 'g', metaKey: true })
    const goBtn = view.getByRole('button', { name: 'Go' })
    fireEvent.click(goBtn)

    // Click outside lines does nothing
    fireEvent.click(view.container)
  })

  it('renders plain text badge when file has no extension', () => {
    const view = render(<CodeBody {...props(contents(['plain text line'], true), { resourceAddress: sessionFileAddress(SESSION, 'LICENSE') })} />)
    expect(view.getByText('Plain Text')).toBeTruthy()
  })

  it('renders zero lines when content is empty string', () => {
    const view = render(<CodeBody {...props(contents([''], true))} />)
    expect(view.getByText('0 lines')).toBeTruthy()
  })
})
