import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/models';
import mongoose from 'mongoose';
import {
  checkAdminAuth,
  applyAdminRateLimit,
  validatePagination,
  adminResponse,
  adminError,
  logAdminAction,
} from '@/app/lib/admin-middleware';

const surveySchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    status: { type: String, enum: ['draft', 'active', 'inactive'], default: 'draft' },
    reward_amount: { type: Number, default: 0, min: 0 },
    total_responses: { type: Number, default: 0, min: 0 },
    question_count: { type: Number, default: 0, min: 0 },
    questions: Array,
    created_by: String,
  },
  { timestamps: true }
);

let Survey: mongoose.Model<any>;

export async function GET(request: NextRequest) {
  try {
    // 1. Admin authorization
    const authResult = await checkAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.error;
    }

    // 2. Rate limiting
    const rateLimitResult = applyAdminRateLimit(request, authResult.userId);
    if (rateLimitResult.limited) {
      return rateLimitResult.response;
    }

    // 3. Database connection
    await connectToDatabase();

    if (!Survey) {
      Survey = mongoose.models.Survey || mongoose.model('Survey', surveySchema);
    }

    // 4. Validate pagination
    const pageParam = request.nextUrl.searchParams.get('page');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const { page, limit, skip } = validatePagination(pageParam, limitParam);

    const search = request.nextUrl.searchParams.get('search') || '';
    const status = request.nextUrl.searchParams.get('status') || '';

    const query: Record<string, any> = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      query.status = status;
    }

    // Fetch paginated surveys
    const surveys = await Survey.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await Survey.countDocuments(query);

    // Get statistics
    const stats = await Survey.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          active: [
            { $match: { status: 'active' } },
            { $count: 'count' },
          ],
          inactive: [
            { $match: { status: 'inactive' } },
            { $count: 'count' },
          ],
          totalResponses: [
            { $group: { _id: null, count: { $sum: '$total_responses' } } },
          ],
        },
      },
    ]);

    const statsData = stats[0] || {};

    return NextResponse.json(
      {
        success: true,
        data: {
          surveys: surveys.map((survey: any) => ({
            _id: survey._id?.toString(),
            title: survey.title,
            description: survey.description,
            status: survey.status,
            reward_amount: survey.reward_amount || 0,
            total_responses: survey.total_responses || 0,
            question_count: survey.question_count || 0,
            createdAt: survey.createdAt,
            updatedAt: survey.updatedAt,
          })),
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
          stats: {
            total: statsData.total?.[0]?.count || 0,
            active: statsData.active?.[0]?.count || 0,
            inactive: statsData.inactive?.[0]?.count || 0,
            totalResponses: statsData.totalResponses?.[0]?.count || 0,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Surveys API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch surveys' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Admin authorization
    const authResult = await checkAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.error;
    }

    // 2. Rate limiting
    const rateLimitResult = applyAdminRateLimit(request, authResult.userId);
    if (rateLimitResult.limited) {
      return rateLimitResult.response;
    }

    // 3. Validate request body
    const body = await request.json();
    const { title, description, reward_amount, questions } = body;

    if (!title || !description) {
      return adminError('Missing required fields: title and description', 400);
    }

    // 4. Database connection
    await connectToDatabase();

    if (!Survey) {
      Survey = mongoose.models.Survey || mongoose.model('Survey', surveySchema);
    }

    // 5. Create survey
    const survey = await Survey.create({
      title,
      description,
      reward_amount: reward_amount || 0,
      questions: questions || [],
      question_count: questions?.length || 0,
      status: 'draft',
      created_by: authResult.userId,
    });

    // 6. Log the action
    await logAdminAction(
      authResult.userId,
      authResult.name || authResult.email,
      'SURVEY_CREATE',
      'survey',
      survey._id?.toString(),
      { title, description, reward_amount },
      'success'
    );

    return adminResponse(
      {
        message: 'Survey created successfully',
        survey: {
          _id: survey._id?.toString(),
          title,
          description,
          reward_amount,
          status: 'draft',
        },
      },
      201
    );
  } catch (error) {
    console.error('[Admin] Surveys POST error:', error);
    return adminError(
      error instanceof Error ? error.message : 'Failed to create survey',
      500
    );
  }
}
