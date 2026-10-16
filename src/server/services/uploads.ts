import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/** Folder (inside the project) where uploaded images are stored; git-ignored */
export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

/** Subfolders an upload may go to (the first part of the stored key) */
export const UPLOAD_FOLDERS = ['banks'] as const

/** Saves an uploaded image and returns its key ("banks/<uuid>.png") */
export async function saveImage(
  folder: (typeof UPLOAD_FOLDERS)[number],
  file: File,
): Promise<string> {
  const ext = TYPES[file.type]
  if (!ext) throw new Error('Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Ảnh tối đa 2MB')
  const key = `${folder}/${randomUUID()}.${ext}`
  const dir = path.join(UPLOAD_DIR, folder)
  await mkdir(dir, { recursive: true })
  await writeFile(
    path.join(UPLOAD_DIR, key),
    Buffer.from(await file.arrayBuffer()),
  )
  return key
}

/** Reads a stored image by key; null when missing or when the key escapes the folder */
export async function readImage(key: string) {
  const full = path.resolve(UPLOAD_DIR, key)
  if (!full.startsWith(UPLOAD_DIR + path.sep)) return null
  const ext = path.extname(full).slice(1).toLowerCase()
  const type = MIME_BY_EXT[ext]
  if (!type) return null
  try {
    return { data: await readFile(full), type }
  } catch {
    return null
  }
}
