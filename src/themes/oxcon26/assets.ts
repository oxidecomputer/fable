import fullHeightOx from './assets/full-height-ox.svg'
import wordmark from './assets/wordmark.svg'

/**
 * Theme asset URLs, exported through '@oxide/fable' so doc-stored templates
 * (which can't import files) can use them too. `fullHeightOx` is a 1920×1080
 * dark reverse of the 0X mark — layered over the shader background, the mark's
 * bars are cut out so the texture shows through. `wordmark` is the 273×78
 * grey Oxide wordmark.
 */
export const oxconAssets = {
  fullHeightOx,
  wordmark,
}
