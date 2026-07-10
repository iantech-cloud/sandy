import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/models';
import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema(
  {
    title: String,
    content: String,
    author: String,
    status: String,
    category: String,
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

let Blog: mongoose.Model<any>;

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

    if (!Blog) {
      Blog = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
    }

    const blog = await Blog.findById(params.id).lean();

    if (!blog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: blog,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Blog GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blog' },
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

    if (!Blog) {
      Blog = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
    }

    const blog = await Blog.findByIdAndUpdate(params.id, body, { new: true }).lean();

    if (!blog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Blog updated successfully',
        data: blog,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Blog PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update blog' },
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

    if (!Blog) {
      Blog = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
    }

    const blog = await Blog.findByIdAndDelete(params.id).lean();

    if (!blog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Blog deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Blog DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete blog' },
      { status: 500 }
    );
  }
}
