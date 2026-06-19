import { connectToDatabase } from '@/app/lib/models';
import { PremiumSubscription, CoopBankPayment } from '@/app/lib/models/RevenueStreams';
import { CoopBankService } from '@/app/lib/services/coopBankService';
import { getSession } from 'next-auth/react';
import { NextRequest, NextResponse } from 'next/server';

const PREMIUM_PLANS = {
  basic: {
    name: 'Basic',
    price: 299, // KES
    features: [
      'Early access to jobs',
      'Basic analytics',
      '5 job applications per week',
      'Email support'
    ]
  },
  pro: {
    name: 'Professional',
    price: 599, // KES
    features: [
      'Early access to jobs',
      'Advanced analytics',
      'Unlimited job applications',
      'Priority support',
      'Featured profile',
      'Monthly bonus KES 50'
    ]
  }
};

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: PREMIUM_PLANS
    });
  } catch (error: any) {
    console.error('[Premium API] GET error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

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

    const { plan, phone_number } = body;

    if (!plan || !Object.keys(PREMIUM_PLANS).includes(plan)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid plan' 
      }, { status: 400 });
    }

    if (!phone_number) {
      return NextResponse.json({ 
        success: false, 
        message: 'Phone number required' 
      }, { status: 400 });
    }

    // Check if user already has active subscription
    const existingSubscription = await PremiumSubscription.findOne({
      user_id: session.user.id,
      status: 'active'
    });

    if (existingSubscription) {
      return NextResponse.json({ 
        success: false, 
        message: 'User already has active subscription' 
      }, { status: 400 });
    }

    const planData = PREMIUM_PLANS[plan as keyof typeof PREMIUM_PLANS];
    const priceCents = Math.round(planData.price * 100);

    // Initiate payment
    const paymentResult = await CoopBankService.initiatePayment(
      session.user.id,
      {
        amount: planData.price,
        phone_number,
        reference: `PREMIUM-${session.user.id}-${Date.now()}`,
        description: `HustleHub Premium ${plan} Subscription`
      },
      'premium_subscription',
      `PREMIUM-${Date.now()}`
    );

    if (!paymentResult.success) {
      return NextResponse.json({ 
        success: false, 
        message: paymentResult.message 
      }, { status: 400 });
    }

    // Create subscription record (pending payment)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const subscription = new PremiumSubscription({
      user_id: session.user.id,
      plan,
      price_cents: priceCents,
      status: 'active', // Will be verified on webhook
      expires_at: expiresAt,
      auto_renew: true,
      payment_id: paymentResult.data?._id,
      benefits: planData.features
    });

    await subscription.save();

    return NextResponse.json({
      success: true,
      message: 'Subscription initiated, awaiting payment confirmation',
      data: {
        subscription,
        payment: paymentResult
      }
    });
  } catch (error: any) {
    console.error('[Premium API] POST error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * GET /api/marketplace/premium/my-subscription
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

    const subscription = await PremiumSubscription.findOne({
      user_id: session.user.id
    }).sort({ created_at: -1 });

    if (!subscription) {
      return NextResponse.json({ 
        success: false, 
        message: 'No subscription found' 
      }, { status: 404 });
    }

    // Check if expired
    if (subscription.expires_at < new Date()) {
      subscription.status = 'expired';
      await subscription.save();
    }

    return NextResponse.json({
      success: true,
      data: subscription
    });
  } catch (error: any) {
    console.error('[Premium Subscription API] PUT error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
