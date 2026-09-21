# Backend Requirements: Web Code Editor & Enhanced File Viewer

## Context
Currently, the DeepSeek Harness Web GUI provides file inspection through a read-only syntax-highlighted block (`ui-sidebar-documentpreview` with `CodeBlock`). While this works for quick glance inspections, users working on real-world projects need a richer, more powerful code viewer and editor interface (akin to Monaco Editor or CodeMirror 6):
- Better code exploration: line numbers, code folding, minimap, in-file search & replace, jump to line, bracket matching.
- Real-time agent collaboration: live visual reflection of file edits made by the agent during conversation turns (live reload, flash updated lines).
- Diff view: comparing agent-modified files against the pre-turn baseline or git HEAD.
- Optional interactive editing: allowing developers to tweak code directly in the web browser and save back to the workspace.

Target users: Developers and engineers interacting with DeepSeek Harness through the Web GUI at `http://127.0.0.1:3080`.

---

## Screens/Components

### 1. Code Editor / Viewer Pane (Main / Sidebar)
**Purpose**: Render file content with rich editing and code-reading capabilities instead of a static read-only text block.

**Data I need to display**:
- File identity: relative display path, full workspace path, file name, and file extension.
- Detected programming language grammar (for syntax highlighting, bracket matching, indentation rules).
- Full file content (or virtualized chunks for large files).
- File metadata: byte size, total line count, encoding (UTF-8 by default), line endings (LF / CRLF).
- Write permission / Capability flags: whether the current file is read-only (due to sandbox confinement, file permissions, or outside workspace boundaries) or editable.
- Real-time modification signal: an indicator when the currently open file has been modified on disk by the agent or an external process, optionally with the changed line numbers.
- Unsaved / dirty status: indicator when client-side edits diverge from the disk version.

**Actions**:
- User opens a file from the file tree, chat reference, or tool card → editor mounts with correct language syntax and cursor position.
- User scrolls, folds code blocks, or clicks the minimap → smooth scrolling and layout preservation.
- User triggers search (`Cmd+F` / `Ctrl+F`) → in-editor search bar highlights occurrences and jumps between matches.
- User toggles view settings (word wrap, line numbers, minimap, white space) → editor view reconfigures immediately without refetching.
- User switches view mode (for Markdown/HTML/SVG) between "Code Editor" and "Rendered Preview".
- User edits file and triggers save (`Cmd+S` / `Ctrl+S`) → request to persist changes to disk, returning confirmation or conflict notice.
- User reloads file after external modification notification → editor refreshes buffer to latest disk state.

**States to handle**:
- **Empty**: File exists but has 0 bytes (render empty editor with line 1 cursor).
- **Loading**: File content is being fetched or streamed from host (render skeleton/shimmer loader in editor frame).
- **Error**: File not found, permission denied, or file removed from disk while open (render clear error banner with retry/close actions).
- **Large File**: File exceeds memory-safe threshold for the web editor (e.g. > 5 MB) → render notice offering partial view or download instead of freezing browser thread.
- **Binary File**: File is detected as non-text / binary → fall back to binary asset viewer or download prompt.
- **Save Conflict**: Disk version changed while user was typing local edits → present conflict resolution choice (overwrite, discard local, or view diff).

**Business rules affecting UI**:
- When the active session runs under a read-only sandbox policy, the editor must strictly lock into read-only mode and display a "Read-Only (Sandbox)" lock badge.
- When an agent turn is actively executing a tool (`write` or `edit`) on the open file, the editor should visually indicate that the file is being modified by the agent.

---

## 2. Diff & Change Reviewer
**Purpose**: Allow users to inspect exactly what the agent changed in a file during a turn, or compare against git HEAD.

**Data I need to display**:
- Baseline content (before agent step or git HEAD) and Head content (after agent step or current working tree).
- Changed hunks: line ranges of additions, deletions, and modifications.
- Step / turn attribution: which agent turn or tool call created the change.
- Diff summary: added lines count (`+N`) and removed lines count (`-M`).

**Actions**:
- User switches diff presentation between "Split / Side-by-Side" and "Unified / Inline".
- User navigates next/previous difference chunk (`F7` / `Shift+F7` or arrow buttons) → editor jumps directly to the hunk.
- User clicks a file reference chip in the chat transcript with line ranges → editor scrolls to and highlights the referenced lines.

**States to handle**:
- **Empty**: No differences between baseline and head (render "No changes detected" state).
- **Loading**: Computing or retrieving baseline content (render diff placeholder).
- **Error**: Baseline history unavailable for this file (render explanatory notice and fallback to regular editor).

**Business rules affecting UI**:
- The diff view is always read-only.

---

## 3. Open Tabs & File Navigation Header
**Purpose**: Allow multi-file navigation so users can have multiple relevant files open simultaneously while chatting with the agent.

**Data I need to display**:
- List of currently open files: display title, file icon, active flag, and dirty indicator (`•`).
- Active file's breadcrumbs: folder hierarchy leading to the file.

**Actions**:
- User clicks a tab → switches active editor view without re-downloading unchanged buffer.
- User closes a tab (`x` or middle-click) → closes buffer; if buffer is dirty, prompts to save or discard.
- User closes other tabs or closes all tabs → cleans up tab list.

**States to handle**:
- **Empty**: All tabs closed (display workspace placeholder or file tree invitation).
- **Single / Many**: Scrollable tab list with overflow menu when tab count exceeds header width.

---

## Uncertainties
- [ ] Not sure if the backend already provides an authorized RPC for saving user edits back to the workspace file system, or if web writes currently only happen through agent tool executions (`write`/`edit`).
- [ ] Not sure how file change events are currently broadcast to the browser: does the host publish an SSE/WebSocket event when `fs/observed` fires, or does the client need a dedicated subscription?
- [ ] Not sure if backend has or plans to expose Language Server Protocol (LSP) diagnostics and completion services over the Remote Gateway, or if frontend should purely rely on client-side language grammars (e.g. Monaco/CodeMirror syntax tokens).
- [ ] Not sure how baseline snapshots for diffs are stored: does the backend retain before-edit snapshots in session history, or should the frontend compute diffs against git working trees?

---

## Questions for Backend
- Is there an existing remote method for reading full text files and writing updated text files with version/etag checks to avoid write collisions?
- When the agent modifies a file on disk, what event does the host emit over the client connection so the editor can trigger a live reload or flash modified lines?
- Can the host provide pre-computed diff hunks for agent tool calls, or should frontend receive both raw strings and compute the diff locally via a web worker?
- Would it make sense to roll out in two phases:
  - **Phase 1**: Rich read-only code editor & diff viewer (Monaco / CodeMirror 6 with syntax highlighting, line numbers, code folding, search, minimap, and agent change diffs).
  - **Phase 2**: Bidirectional editing and saving with workspace conflict resolution?

---

## Discussion Log
*Awaiting backend feedback and decisions on data availability and event subscriptions.*
