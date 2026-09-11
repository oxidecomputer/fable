import type * as Y from 'yjs'

/**
 * Undo/redo routes to the room's shared Y.UndoManager, which tracks only
 * local-origin transactions — undo reverts only this client's edits.
 */
let undoManager: Y.UndoManager | null = null

export function setUndoManager(um: Y.UndoManager | null): void {
  undoManager = um
}

export function undo(): void {
  undoManager?.undo()
}

export function redo(): void {
  undoManager?.redo()
}

/** Close the current capture group so the next edit starts a fresh undo step. */
export function stopCapturing(): void {
  undoManager?.stopCapturing()
}
