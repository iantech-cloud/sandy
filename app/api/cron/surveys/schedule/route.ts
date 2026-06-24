import { NextRequest, NextResponse } from 'next/server';
import { activateScheduledSurveys, expireSurveys, assignSurveys } from '@/app/lib/survey-scheduler';

/**
 * Cron endpoint to trigger survey scheduling tasks
 * Should be called every minute via Vercel Cron or external service
 * 
 * Secured with CRON_SECRET environment variable
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    
    if (!expectedSecret || cronSecret !== expectedSecret) {
      console.warn('[SurveyScheduler] Unauthorized cron request attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[SurveyScheduler] Starting scheduled tasks...');

    // Execute scheduler tasks
    const startTime = Date.now();
    
    // 1. Activate surveys that are scheduled
    await activateScheduledSurveys();
    
    // 2. Assign surveys to users
    await assignSurveys();
    
    // 3. Expire surveys that have passed expiration
    await expireSurveys();

    const duration = Date.now() - startTime;

    console.log(`[SurveyScheduler] Completed all tasks in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Survey scheduling tasks completed',
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[SurveyScheduler] Error executing scheduler:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute survey scheduling',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for testing and monitoring
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Allow GET with query parameter for testing
    const cronSecret = request.nextUrl.searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    
    if (!expectedSecret || cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      endpoint: '/api/cron/surveys/schedule',
      method: 'POST',
      auth: 'Bearer {CRON_SECRET}',
      message: 'Send POST request with Authorization header to trigger survey scheduling',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
