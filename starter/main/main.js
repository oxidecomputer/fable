import '@oxide/fable/src/main.tsx'

import data from './content.toml'

window.ENV = {
  content: data,
  dir: import.meta.env.VITE_DIR,
}
