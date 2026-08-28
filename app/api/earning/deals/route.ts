import { NextResponse } from 'next/server'

const EBAY_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ success: false, message: 'Search must contain at least two characters.' }, { status: 400 })
  const token = process.env.EBAY_APP_TOKEN
  if (!token) return NextResponse.json({ success: false, message: 'eBay Browse API is not configured yet.', provider: 'ebay' }, { status: 503 })
  const limit = Math.min(Number(searchParams.get('limit') || 20), 50)
  const url = new URL(EBAY_ENDPOINT)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(Math.max(Number(searchParams.get('offset') || 0), 0)))
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': process.env.EBAY_MARKETPLACE_ID || 'EBAY_US', Accept: 'application/json' }, next: { revalidate: 300 } })
    if (!response.ok) return NextResponse.json({ success: false, message: 'The product provider could not be reached.' }, { status: 502 })
    const payload = await response.json()
    const items = (payload.itemSummaries || []).map((item: any) => ({ id: item.itemId, title: item.title, image: item.image?.imageUrl, price: item.price?.value, currency: item.price?.currency, shipping: item.shippingOptions?.[0]?.shippingCost?.value ?? null, sellerRating: item.seller?.feedbackPercentage ?? null, reviews: item.reviews?.reviewCount ?? null, url: `/api/earning/deals/click?item=${encodeURIComponent(item.itemId)}&url=${encodeURIComponent(item.itemWebUrl || '')}`, provider: 'ebay' }))
    return NextResponse.json({ success: true, provider: 'ebay', total: payload.total ?? items.length, items })
  } catch { return NextResponse.json({ success: false, message: 'Product search timed out.' }, { status: 504 }) }
}
