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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const survey = await Survey.findById(params.id).lean();

    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: survey,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Survey GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch survey' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();

    await connectToDatabase();

    if (!Survey) {
      Survey = mongoose.models.Survey || mongoose.model('Survey', surveySchema);
    }

    const survey = await Survey.findByIdAndUpdate(params.id, body, { new: true }).lean();

    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Survey updated successfully',
        data: survey,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Survey PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update survey' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const survey = await Survey.findByIdAndDelete(params.id).lean();

    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Survey deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Survey DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete survey' },
      { status: 500 }
    );
  }
}
