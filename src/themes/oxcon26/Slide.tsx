import type { ReactNode } from 'react'
import { z } from 'zod'

/**
 * The shared `variant: light | dark` schema field for tone-aware templates:
 * spread-free reuse of the enum every template was declaring by hand. Pass it
 * through to Slide with the template's default, e.g.
 * `tone={data.variant ?? 'light'}`.
 */
export const toneVariant = z
  .enum(['light', 'dark'])
  .optional()
  .describe('slide tone; color roles flip with it (each template has its own default)')

/**
 * The slide shell: fills the stage, clips overflow, and sets the tone —
 * 'dark' is the theme's near-black; 'light' applies .oxcon-light
 * (neutral-100 surface, grey body text, medium near-black strong) plus
 * data-theme="light", so the design system's semantic tokens — including
 * the --syntax-* vars shiki-highlighted code resolves — flip to their
 * light values inside the slide.
 */
export function Slide({
  tone = 'dark',
  className = '',
  children,
}: {
  tone?: 'dark' | 'light'
  className?: string
  children: ReactNode
}) {
  return (
    <div
      data-theme={tone === 'light' ? 'light' : undefined}
      className={`relative h-full w-full overflow-hidden ${
        tone === 'light' ? 'oxcon-light' : 'bg-default'
      } ${className}`}
    >
      {children}
    </div>
  )
}
