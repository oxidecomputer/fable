/** Core template API, shared verbatim by file imports and document evaluation. */
export { Markdown, FitText, SlideImage } from './templates/Util'
export { useStage } from './stage'
export { imageField, markdownField } from './collab/fields'
export { useImageSrc, useFiles } from './files'
export type { StageMode } from './stage'
export type { TemplateMap, TemplateModule } from './model'
export type { Theme } from './theme'
