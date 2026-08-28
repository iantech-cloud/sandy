import { NextRequest, NextResponse } from 'next/server'

const ENDPOINT = 'https://api.ebay.com/sell/inventory/mapping/v1/graphql'
const mutation = `mutation Start($input: StartListingPreviewsCreationInput!) { startListingPreviewsCreation(input: $input) { listingPreviewsCreationTask { id result { completionStatus listingPreviews { mappingReferenceId title product { epid } category { categoryId name } } } } } }`

export async function POST(request: NextRequest) {
  const token = process.env.EBAY_OAUTH_TOKEN
  if (!token) return NextResponse.json({ success: false, message: 'eBay Inventory Mapping OAuth is not configured.' }, { status: 503 })
  const input = await request.json()
  if (!Array.isArray(input.products) || input.products.length === 0 || input.products.length > 10) return NextResponse.json({ success: false, message: 'Provide between 1 and 10 products.' }, { status: 400 })
  const response = await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' }, body: JSON.stringify({ query: mutation, variables: { input: { externalProductDetails: input.products } } }) })
  if (!response.ok) return NextResponse.json({ success: false, message: 'eBay mapping request failed.' }, { status: 502 })
  return NextResponse.json({ success: true, data: await response.json() })
}
