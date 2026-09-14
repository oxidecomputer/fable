import { createContext, useContext } from 'react'

/**
 * Room-stored files. Assets belong to the deck's Liveblocks room (uploaded
 * via the dev middleware / hosted server, which proxy to Liveblocks file
 * storage) and are referenced from page sources as `fable:<fileId>` — image
 * fields and inline markdown images alike. Download URLs are presigned and
 * short-lived, so refs resolve through the backend on every render rather
 * than being stored resolved.
 */
export const FILE_REF_PREFIX = 'fable:'

export function isFileRef(value: string): boolean {
  return value.startsWith(FILE_REF_PREFIX)
}

export type FableFiles = {
  /** Stable URL for a `fable:<fileId>` ref (the backend redirects to storage). */
  fileUrl: (ref: string) => string
  /** Upload a file to the room; resolves to the `fable:<fileId>` ref to store. */
  upload: (file: File) => Promise<string>
}

export const FilesContext = createContext<FableFiles | null>(null)

export function useFiles(): FableFiles | null {
  return useContext(FilesContext)
}

/**
 * An image field's value as an `img src`: URLs and public/ paths pass
 * through; `fable:` refs resolve via the room's file backend (undefined when
 * no backend is available, e.g. a static build without a server).
 */
export function useImageSrc(value: string | undefined): string | undefined {
  const files = useContext(FilesContext)
  if (value === undefined || !isFileRef(value)) return value
  return files ? files.fileUrl(value) : undefined
}

/**
 * Client for the files endpoints: `POST <endpoint>/<roomId>` uploads raw
 * bytes, `GET <endpoint>/<roomId>/<fileId>` redirects to a presigned
 * download URL. Dev serves them at /_fable/files; the hosted server at
 * /api/files (shared-token auth rides in a `token` query for use in img src).
 */
export function createFilesClient(
  endpoint: string,
  roomId: string,
  apiToken?: string,
): FableFiles {
  const base = `${endpoint}/${encodeURIComponent(roomId)}`
  const tokenQuery = apiToken ? `?token=${encodeURIComponent(apiToken)}` : ''
  return {
    fileUrl: (ref) =>
      `${base}/${encodeURIComponent(ref.slice(FILE_REF_PREFIX.length))}${tokenQuery}`,
    upload: async (file) => {
      const res = await fetch(base, {
        method: 'POST',
        headers: {
          'content-type': file.type || 'application/octet-stream',
          'x-fable-filename': encodeURIComponent(file.name || 'upload'),
          ...(apiToken ? { authorization: `Bearer ${apiToken}` } : {}),
        },
        body: file,
      })
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status} ${await res.text()}`)
      }
      const { id } = await res.json()
      if (typeof id !== 'string') throw new Error('Upload failed: no file id returned')
      return FILE_REF_PREFIX + id
    },
  }
}
