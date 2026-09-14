import { atom } from '@tldraw/state'

/**
 * Whether an image file is currently being dragged over the window. Image
 * fields (SlideImage) light up as drop targets while this is true. Tracking
 * is installed by the edit view.
 */
export const $imageDragActive = atom('imageDragActive', false)

export function dragHasImage(e: DragEvent | React.DragEvent): boolean {
  return Array.from(e.dataTransfer?.items ?? []).some(
    (item) => item.kind === 'file' && item.type.startsWith('image/'),
  )
}

/** First image file of a drop, if any. */
export function droppedImage(e: React.DragEvent): File | undefined {
  return Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
}

/**
 * Window-level drag tracking for {@link $imageDragActive}. dragenter/dragleave
 * fire for every element boundary, so a depth counter tells actual
 * enters/exits of the window apart from internal churn.
 */
export function installImageDragTracking(): () => void {
  let depth = 0
  const enter = (e: DragEvent) => {
    depth++
    if (dragHasImage(e)) $imageDragActive.set(true)
  }
  const leave = () => {
    depth--
    if (depth <= 0) {
      depth = 0
      $imageDragActive.set(false)
    }
  }
  const end = () => {
    depth = 0
    $imageDragActive.set(false)
  }
  // Capture phase: field drop targets stopPropagation on drop, which would
  // otherwise keep the end listener from firing and leave targets outlined.
  window.addEventListener('dragenter', enter, true)
  window.addEventListener('dragleave', leave, true)
  window.addEventListener('drop', end, true)
  window.addEventListener('dragend', end, true)
  return () => {
    window.removeEventListener('dragenter', enter, true)
    window.removeEventListener('dragleave', leave, true)
    window.removeEventListener('drop', end, true)
    window.removeEventListener('dragend', end, true)
  }
}
