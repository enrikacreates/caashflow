'use server'

/**
 * Google Custom Search → image results.
 *
 * Backs the "search the web for an image" picker so users (esp. family members
 * who don't know how to grab image URLs) can search → tap → attach.
 *
 * Requires env vars:
 *   GOOGLE_CSE_KEY  — API key from Google Cloud Console (Custom Search API enabled)
 *   GOOGLE_CSE_ID   — the cx ID of a Custom Search Engine configured to search
 *                     the entire web with Image Search turned on
 *
 * Free tier: 100 queries/day. Safe-search is forced ON.
 */

export interface ImageResult {
  url: string        // Full-res image URL — what we save to image_url
  thumbUrl: string   // Thumbnail — what the picker grid renders
  title: string      // Alt text / source-page title
  source: string     // The page that hosts the image (so we can credit/link)
  width?: number
  height?: number
}

export async function searchWebImages(query: string): Promise<ImageResult[]> {
  const q = (query ?? '').trim()
  if (!q) return []
  const key = process.env.GOOGLE_CSE_KEY
  const cx = process.env.GOOGLE_CSE_ID
  if (!key || !cx) {
    throw new Error('Image search is not configured — set GOOGLE_CSE_KEY and GOOGLE_CSE_ID')
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', key)
  url.searchParams.set('cx', cx)
  url.searchParams.set('q', q)
  url.searchParams.set('searchType', 'image')
  url.searchParams.set('num', '10')
  url.searchParams.set('safe', 'active') // family-safe
  url.searchParams.set('imgSize', 'large')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Image search failed (${res.status}): ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    items?: Array<{
      link: string
      title?: string
      image?: { thumbnailLink?: string; contextLink?: string; width?: number; height?: number }
    }>
  }
  return (data.items ?? []).map((it) => ({
    url: it.link,
    thumbUrl: it.image?.thumbnailLink ?? it.link,
    title: it.title ?? '',
    source: it.image?.contextLink ?? '',
    width: it.image?.width,
    height: it.image?.height,
  }))
}
