/** Locale-owned code renderer name and CodeBlock controls. */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Code document implementation name and copy controls. */
    sidebarCodePreview: keyof typeof zh
  }
}

/** Simplified Chinese dictionary and key source. */
export const zh = {
  title: '代码',
  copy: '复制',
  copied: '已复制',
  find: '查找',
  findPlaceholder: '在文件中查找…',
  noMatches: '无结果',
  previousMatch: '上一个匹配项',
  nextMatch: '下一个匹配项',
  close: '关闭',
  goToLine: '转到行',
  goToLinePlaceholder: '行号…',
  go: '跳转',
  lines: '行',
  linePrefix: '行 ',
  plainText: '纯文本',
  encoding: 'UTF-8',
}

/** English dictionary with the same keys. */
export const en = {
  title: 'Code',
  copy: 'Copy',
  copied: 'Copied',
  find: 'Find',
  findPlaceholder: 'Find in file…',
  noMatches: 'No matches',
  previousMatch: 'Previous match',
  nextMatch: 'Next match',
  close: 'Close',
  goToLine: 'Go to Line',
  goToLinePlaceholder: 'Line number…',
  go: 'Go',
  lines: 'lines',
  linePrefix: 'Ln ',
  plainText: 'Plain Text',
  encoding: 'UTF-8',
} satisfies Record<keyof typeof zh, string>
