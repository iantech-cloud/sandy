import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/models';
import mongoose from 'mongoose';

const surveySchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    status: { type: String, default: 'draft' },
    reward_amount: { type: Number, default: 0 },
    total_responses: { type: Number, default: 0 },
    question_count: { type: Number, default: 0 },
    questions: Array,
  },
  { timestamps: true }
);

let Survey: mongoose.Model<any>;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    if (!Survey) {
      Survey = mongoose.models.Survey || mongoose.model('Survey', surveySchema);
    }

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    const search = request.nextUrl.searchParams.get('search') || '';
    const status = request.nextUrl.searchParams.get('status') || '';
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (search) {
      query.title = { $regex: search, $options: 'i' };
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
    const session = await auth();

    if (!session?.user?.id || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, description, reward_amount, questions } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    if (!Survey) {
      Survey = mongoose.models.Survey || mongoose.model('Survey', surveySchema);
    }

    const survey = await Survey.create({
      title,
      description,
      reward_amount: reward_amount || 0,
      questions: questions || [],
      question_count: questions?.length || 0,
      status: 'draft',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Survey created successfully',
        data: survey,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Admin] Surveys POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create survey' },
      { status: 500 }
    );
  }
}
