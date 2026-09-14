declare global {
  interface Liveblocks {
    Presence: {
      pageId: string | null
      editingField: string | null
    }
    UserMeta: {
      id: string
      info: {
        name: string
        color: string
        avatar?: string
      }
    }
  }
}

export {}
