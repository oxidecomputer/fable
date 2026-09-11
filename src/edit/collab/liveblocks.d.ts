declare global {
  interface Liveblocks {
    Presence: {
      pageId: string | null
      cursor: { x: number; y: number } | null
    }
    UserMeta: {
      id: string
      info: {
        name: string
        color: string
        avatar?: string
      }
    }
    ThreadMetadata: {
      pageId: string
      x?: number
      y?: number
    }
  }
}

export {}
