import { basename, extname } from 'node:path'
import sharp from 'sharp'

// Usage: bun run images <image> [name]
// Converts any image to a small WebP in frontend/public/fighters/<name>.webp. The name defaults to the
// file name. Several fighters can share one image, e.g. cat-5 and cat-20 can both use /fighters/cat.webp.

const SIZE = 384

const [input, name = basename(input ?? '', extname(input ?? ''))] = process.argv.slice(2)
if (!input) {
  console.error('Usage: bun run images <image> [name]')
  process.exit(1)
}
if (!/^[a-z0-9-]+$/.test(name)) {
  console.error(`"${name}" should be lowercase letters, digits, and dashes. Pass a name as the second argument.`)
  process.exit(1)
}

const out = new URL(`../../frontend/public/fighters/${name}.webp`, import.meta.url).pathname
const info = await sharp(input)
  .trim()
  .resize(SIZE, SIZE, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 80, alphaQuality: 90 })
  .toFile(out)

console.log(`Wrote ${out} (${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB)`)
console.log(`In backend/db/seed.sql, set image_url to '/fighters/${name}.webp'`)
