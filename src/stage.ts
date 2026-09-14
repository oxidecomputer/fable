import { createContext, useContext } from 'react'

/** Slide position supplied by the host view, independent of template fields. */
export const PageInfoContext = createContext<{ number: number; total: number } | null>(null)

/** Thumbnails let expensive template components skip per-frame work. */
export type StageMode = 'stage' | 'thumbnail' | 'present'

export const StageContext = createContext<{ scale: number; mode: StageMode }>({
  scale: 1,
  mode: 'stage',
})

export function useStage() {
  return useContext(StageContext)
}
