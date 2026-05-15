import { react } from '@tldraw/state'
import { $deck, $filenames, $saveStatus } from './store'

let firstRun = true
let pendingTimer: ReturnType<typeof setTimeout> | null = null

async function flush(content: any, filenames: string[]) {
  try {
    $saveStatus.set('saving')
    const res = await fetch('/_fable/content', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, filenames }),
    })
    if (!res.ok) {
      $saveStatus.set('error')
      console.error('Fable persist failed', await res.text())
      return
    }
    $saveStatus.set('saved')
  } catch (err) {
    $saveStatus.set('error')
    console.error('Fable persist error', err)
  }
}

export function startPersist() {
  react('fable-persist', () => {
    const deck = $deck.get()
    const filenames = $filenames.get()
    if (firstRun) {
      firstRun = false
      return
    }
    if (pendingTimer) clearTimeout(pendingTimer)
    $saveStatus.set('idle')
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      flush(deck, filenames)
    }, 400)
  })
}
