export {
  LOCAL_ORIGIN,
  applyTextDiff,
  deckToYUpdate,
  ensureFilenames,
  getMetaMap,
  getOrderArray,
  getPagesMap,
  getTemplatesMap,
  isDocEmpty,
  makePageMap,
  readDeck,
  seedDoc,
} from './doc'
export type { DeckContent, DeckMeta, ReadDeckResult } from './doc'
export { compileTemplate, compileTemplateCached } from './compile'
