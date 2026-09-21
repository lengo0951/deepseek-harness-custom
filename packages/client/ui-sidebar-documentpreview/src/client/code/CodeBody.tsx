/** Incrementally highlighted source; the document owner supplies the accumulated text and wrap preference. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  CodeBlock,
  IconChevronDownOutline14,
  IconChevronUpOutline14,
  IconCloseOutline16,
  IconSearchOutline16,
  fileSizeText,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import type { DocumentPreviewProps } from '../document/contract.ts'
import { scrollToLine } from '../text/lines.ts'
import { languageForPath } from './languages.ts'
import type {} from './locales.ts'
import css from './CodeBody.module.css'

/** Document owner props and this renderer's localized controls. */
export type CodeBodyProps = DocumentPreviewProps & PropsLocale<'sidebarCodePreview'>

/** @param props - accumulated document contents and framework props. @returns one stable CodeBlock, or no body for byte contents. */
export function CodeBody({ resourceAddress, content, wrap, scrollportRef, t }: CodeBodyProps): ReactNode {
  if (content.kind !== 'text') return null
  const file = parseFileAddress(resourceAddress)
  if (file === undefined) throw new Error(`ui-sidebar-documentpreview: not a file address "${resourceAddress}"`)
  const language = languageForPath(file.path)

  const innerScrollportRef = useRef<HTMLDivElement | null>(null)
  const [activeLine, setActiveLine] = useState<number>(1)

  // Find in file state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Go to line state
  const [goToLineOpen, setGoToLineOpen] = useState(false)
  const [goToLineValue, setGoToLineValue] = useState('')
  const goToLineInputRef = useRef<HTMLInputElement>(null)

  const lineCount = useMemo(() => (content.text ? content.text.split('\n').length : 0), [content.text])
  const sizeLabel = useMemo(() => fileSizeText(content.text.length), [content.text])
  const formattedLanguage = useMemo(() => (language ? language.toUpperCase() : t('plainText')), [language, t])

  const handleContentRef = useCallback((element: HTMLDivElement | null) => {
    innerScrollportRef.current = element
    if (typeof scrollportRef === 'function') {
      scrollportRef(element)
    }
  }, [scrollportRef])

  const matches = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    const lines = content.text.split('\n')
    const found: { line: number }[] = []
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i]?.toLowerCase() ?? ''
      let idx = lineText.indexOf(query)
      while (idx !== -1) {
        found.push({ line: i + 1 })
        idx = lineText.indexOf(query, idx + query.length)
      }
    }
    return found
  }, [searchQuery, content.text])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
  }, [])

  const toggleSearch = useCallback(() => {
    setSearchOpen(prev => !prev)
  }, [])

  const closeGoToLine = useCallback(() => {
    setGoToLineOpen(false)
  }, [])

  const toggleGoToLine = useCallback(() => {
    setGoToLineOpen(prev => !prev)
  }, [])

  const jumpToMatch = useCallback((index: number) => {
    /* v8 ignore next -- defensive check when invoked with empty matches */
    if (matches.length === 0) return
    const safeIndex = ((index % matches.length) + matches.length) % matches.length
    setActiveMatchIndex(safeIndex)
    const target = matches[safeIndex]
    /* v8 ignore next -- target is guaranteed by safeIndex */
    if (!target) return
    /* v8 ignore next 4 -- defensive check when scrollport DOM node is not yet bound */
    if (innerScrollportRef.current) {
      scrollToLine(innerScrollportRef.current, target.line)
      setActiveLine(target.line)
    }
  }, [matches])

  const handleNextMatch = useCallback(() => {
    jumpToMatch(activeMatchIndex + 1)
  }, [jumpToMatch, activeMatchIndex])

  const handlePrevMatch = useCallback(() => {
    jumpToMatch(activeMatchIndex - 1)
  }, [jumpToMatch, activeMatchIndex])

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        handlePrevMatch()
      } else {
        handleNextMatch()
      }
    } else if (e.key === 'Escape') {
      setSearchOpen(false)
    }
  }

  const handleGoToLineSubmit = useCallback((e?: FormEvent) => {
    e?.preventDefault()
    const target = parseInt(goToLineValue.trim(), 10)
    if (!isNaN(target) && target >= 1 && innerScrollportRef.current) {
      const bounded = Math.min(target, lineCount)
      scrollToLine(innerScrollportRef.current, bounded)
      setActiveLine(bounded)
      setGoToLineOpen(false)
      setGoToLineValue('')
    }
  }, [goToLineValue, lineCount])

  const handleCodeClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const lineElement = target.closest('.line')
    /* v8 ignore next -- defensive check when clicked element is not in an active parent */
    if (!lineElement?.parentElement) return
    const allLines = Array.from(lineElement.parentElement.querySelectorAll('.line'))
    const lineIndex = allLines.indexOf(lineElement)
    /* v8 ignore next -- lineElement is guaranteed to be in allLines */
    if (lineIndex !== -1) {
      setActiveLine(lineIndex + 1)
    }
  }, [])

  useEffect(() => {
    if (matches.length > 0) {
      jumpToMatch(0)
    }
  }, [matches, jumpToMatch])

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.select()
    }
  }, [searchOpen])

  useEffect(() => {
    if (goToLineOpen) {
      goToLineInputRef.current?.select()
    }
  }, [goToLineOpen])

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        setGoToLineOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className={css.renderer} data-code-preview data-wrap={wrap}>
      {searchOpen && (
        <div className={css.searchBar}>
          <input
            ref={searchInputRef}
            className={css.searchInput}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('findPlaceholder')}
          />
          <span className={css.searchMatches}>
            {searchQuery.trim() === ''
              ? ''
              : matches.length === 0
                ? t('noMatches')
                : `${activeMatchIndex + 1}/${matches.length}`}
          </span>
          <button
            type="button"
            className={css.iconButton}
            onClick={handlePrevMatch}
            disabled={matches.length === 0}
            title={t('previousMatch')}
          >
            <IconChevronUpOutline14 size={14} />
          </button>
          <button
            type="button"
            className={css.iconButton}
            onClick={handleNextMatch}
            disabled={matches.length === 0}
            title={t('nextMatch')}
          >
            <IconChevronDownOutline14 size={14} />
          </button>
          <button
            type="button"
            className={css.iconButton}
            onClick={closeSearch}
            title={t('close')}
          >
            <IconCloseOutline16 size={14} />
          </button>
        </div>
      )}

      {goToLineOpen && (
        <form className={css.goToLineBar} onSubmit={handleGoToLineSubmit}>
          <input
            ref={goToLineInputRef}
            type="number"
            min={1}
            max={lineCount}
            className={css.goToLineInput}
            value={goToLineValue}
            onChange={e => setGoToLineValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') closeGoToLine() }}
            placeholder={t('goToLinePlaceholder')}
          />
          <button type="submit" className={css.goToLineSubmit}>
            {t('go')}
          </button>
          <button
            type="button"
            className={css.iconButton}
            onClick={closeGoToLine}
            title={t('close')}
          >
            <IconCloseOutline16 size={14} />
          </button>
        </form>
      )}

      <div onClick={handleCodeClick} style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <CodeBlock
          className={css.code}
          contentRef={handleContentRef}
          code={content.text}
          lang={language}
          streaming={!content.eof}
          lineNumbers
          copyLabel={t('copy')}
          copiedLabel={t('copied')}
        />
      </div>

      <div className={css.statusBar}>
        <div className={css.statusGroup}>
          <span className={css.statusItem}>
            {t('linePrefix')}{activeLine}
          </span>
          <span className={css.statusItem}>
            {lineCount} {t('lines')}
          </span>
          <span className={css.statusItem}>
            {sizeLabel}
          </span>
        </div>
        <div className={css.statusGroup}>
          <button
            type="button"
            className={css.statusAction}
            onClick={toggleSearch}
            title={t('find')}
          >
            <IconSearchOutline16 size={12} />
            <span>{t('find')}</span>
          </button>
          <button
            type="button"
            className={css.statusAction}
            onClick={toggleGoToLine}
            title={t('goToLine')}
          >
            <span>{t('goToLine')}</span>
          </button>
          <span className={css.statusItem}>
            {formattedLanguage}
          </span>
          <span className={css.statusItem}>
            {t('encoding')}
          </span>
        </div>
      </div>
    </div>
  )
}
