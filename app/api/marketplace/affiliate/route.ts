import { connectToDatabase } from '@/app/lib/models';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from 'next-auth/react';

// Import Soko models
import { SokoCampaign, UserAffiliateLink } from '@/app/lib/models/Soko';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const campaign_type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const query: any = { status: 'active' };
    if (campaign_type) query.campaign_type = campaign_type;

    const skip = (page - 1) * limit;

    const campaigns = await SokoCampaign.find(query)
      .sort({ is_featured: -1, start_date: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SokoCampaign.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: campaigns,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('[Affiliate API] GET error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * Join an affiliate campaign
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

    const { campaign_id } = body;

    if (!campaign_id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Campaign ID required' 
      }, { status: 400 });
    }

    const campaign = await SokoCampaign.findById(campaign_id);

    if (!campaign) {
      return NextResponse.json({ 
        success: false, 
        message: 'Campaign not found' 
      }, { status: 404 });
    }

    if (campaign.status !== 'active') {
      return NextResponse.json({ 
        success: false, 
        message: 'Campaign is not active' 
      }, { status: 400 });
    }

    // Check if user already has this affiliate link
    const existingLink = await UserAffiliateLink.findOne({
      user_id: session.user.id,
      campaign_id
    });

    if (existingLink) {
      return NextResponse.json({ 
        success: false, 
        message: 'Already joined this campaign' 
      }, { status: 400 });
    }

    // Generate tracking code
    const trackingCode = `${session.user.id}-${campaign_id}-${Date.now()}`;
    const shortSlug = `aff-${Math.random().toString(36).substring(2, 8)}`;

    const affiliateLink = new UserAffiliateLink({
      user_id: session.user.id,
      campaign_id,
      tracking_code: trackingCode,
      short_slug: shortSlug,
      full_tracking_url: `${process.env.BASE_URL}/track/${trackingCode}`,
      short_tracking_url: `${process.env.BASE_URL}/aff/${shortSlug}`,
      merchant_affiliate_url: campaign.base_affiliate_link,
      campaign_name: campaign.name,
      is_active: true
    });

    await affiliateLink.save();

    // Update campaign participant count
    await SokoCampaign.findByIdAndUpdate(
      campaign_id,
      { $inc: { current_participants: 1 } }
    );

    return NextResponse.json({
      success: true,
      message: 'Successfully joined affiliate campaign',
      data: affiliateLink
    });
  } catch (error: any) {
    console.error('[Affiliate Join API] POST error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * GET /api/marketplace/affiliate/my-links
 * Get user's affiliate links and earnings
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

    const affiliateLinks = await UserAffiliateLink.find({
      user_id: session.user.id
    }).populate('campaign_id', 'name commission_rate');

    const totalEarnings = affiliateLinks.reduce((sum, link) => 
      sum + link.total_commission_earned, 0
    );

    const totalPaid = affiliateLinks.reduce((sum, link) => 
      sum + link.total_commission_paid, 0
    );

    return NextResponse.json({
      success: true,
      data: {
        links: affiliateLinks,
        stats: {
          total_campaigns: affiliateLinks.length,
          total_clicks: affiliateLinks.reduce((sum, link) => sum + link.total_clicks, 0),
          total_conversions: affiliateLinks.reduce((sum, link) => sum + link.total_conversions, 0),
          total_earnings_cents: totalEarnings,
          total_paid_cents: totalPaid,
          pending_cents: totalEarnings - totalPaid
        }
      }
    });
  } catch (error: any) {
    console.error('[My Affiliate Links API] error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
