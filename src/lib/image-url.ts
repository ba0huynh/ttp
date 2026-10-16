/**
 * Address of a stored image. `image` is either a full https:// address (used
 * as is, e.g. VietQR logos) or a key path inside the `uploads/` folder
 * ("banks/3f2a.png"), which is served by the app at `<APP_URL>/uploads/<key>`.
 * `APP_URL` (.env) is baked into the client as `VITE_APP_URL`; when it is
 * empty the same origin is used.
 */
export function imageSrc(image: string | null | undefined): string {
  if (!image) return ''
  if (/^https?:\/\//i.test(image)) return image
  const base = String(import.meta.env.VITE_APP_URL ?? '').replace(/\/+$/, '')
  return `${base}/uploads/${image.replace(/^\/+/, '')}`
}
