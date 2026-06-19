import { connectToDatabase } from '@/app/lib/models';
import { DigitalProduct } from '@/app/lib/models/RevenueStreams';
import { getSession } from 'next-auth/react';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');

    const query: any = { is_active: true };

    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const skip = (page - 1) * limit;

    const products = await DigitalProduct.find(query)
      .sort({ total_sales: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('seller_id', 'username email');

    const total = await DigitalProduct.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('[Digital Products API] GET error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * Upload a digital product
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const session = await getSession({ req });

    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized' 
      }, { status: 401 });
    }

    const {
      title,
      description,
      category,
      price,
      file_url,
      file_type,
      file_size_bytes
    } = body;

    if (!title || !description || !category || !price || !file_url || !file_type) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing required fields' 
      }, { status: 400 });
    }

    const categories = ['notes', 'templates', 'ebook', 'code', 'study_guides', 'other'];
    if (!categories.includes(category)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid category' 
      }, { status: 400 });
    }

    if (price < 50) {
      return NextResponse.json({ 
        success: false, 
        message: 'Minimum price is KES 50' 
      }, { status: 400 });
    }

    // Commission: 15% for HustleHub, 85% for seller
    const priceCents = Math.round(price * 100);
    const commissionCents = Math.round(priceCents * 0.15);
    const sellerEarningsCents = priceCents - commissionCents;

    const product = new DigitalProduct({
      title,
      description,
      category,
      seller_id: session.user.id,
      price_cents: priceCents,
      file_url,
      file_type,
      file_size_bytes,
      is_active: true
    });

    await product.save();

    return NextResponse.json({
      success: true,
      message: 'Digital product uploaded successfully',
      data: product
    });
  } catch (error: any) {
    console.error('[Digital Products Upload API] POST error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * GET /api/marketplace/digital-products/my-products
 * Get user's uploaded products
 */
export async function PUT(req: NextRequest) {
  try {
    await connectToDatabase();

    const session = await getSession({ req });
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized' 
      }, { status: 401 });
    }

    const products = await DigitalProduct.find({
      seller_id: session.user.id
    }).sort({ created_at: -1 });

    const stats = {
      total_products: products.length,
      total_sales: products.reduce((sum, p) => sum + p.total_sales, 0),
      total_revenue_cents: products.reduce((sum, p) => sum + p.total_revenue_cents, 0),
      total_earnings_cents: products.reduce((sum, p) => sum + p.seller_earnings_cents, 0)
    };

    return NextResponse.json({
      success: true,
      data: {
        products,
        stats
      }
    });
  } catch (error: any) {
    console.error('[My Digital Products API] error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * PATCH /api/marketplace/digital-products/categories
 */
export async function PATCH(req: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: {
        categories: [
          { value: 'notes', label: 'Study Notes' },
          { value: 'templates', label: 'Templates' },
          { value: 'ebook', label: 'E-Books' },
          { value: 'code', label: 'Code & Scripts' },
          { value: 'study_guides', label: 'Study Guides' },
          { value: 'other', label: 'Other' }
        ],
        file_types: ['pdf', 'docx', 'xlsx', 'zip', 'pptx', 'other']
      }
    });
  } catch (error: any) {
    console.error('[Product Categories API] error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
