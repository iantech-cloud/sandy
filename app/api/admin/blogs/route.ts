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

    if (!Blog) {
      Blog = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
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

    // Fetch paginated blogs
    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await Blog.countDocuments(query);

    // Get statistics
    const stats = await Blog.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          published: [
            { $match: { status: 'published' } },
            { $count: 'count' },
          ],
          draft: [
            { $match: { status: 'draft' } },
            { $count: 'count' },
          ],
          archived: [
            { $match: { status: 'archived' } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const statsData = stats[0] || {};

    return NextResponse.json(
      {
        success: true,
        data: {
          blogs: blogs.map((blog: any) => ({
            _id: blog._id?.toString(),
            title: blog.title,
            content: blog.content,
            author: blog.author,
            status: blog.status,
            category: blog.category,
            views: blog.views || 0,
            createdAt: blog.createdAt,
            updatedAt: blog.updatedAt,
          })),
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
          stats: {
            total: statsData.total?.[0]?.count || 0,
            published: statsData.published?.[0]?.count || 0,
            draft: statsData.draft?.[0]?.count || 0,
            archived: statsData.archived?.[0]?.count || 0,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Blogs API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blogs' },
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
    const { title, content, author, status, category } = body;

    if (!title || !content || !author) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    if (!Blog) {
      Blog = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
    }

    const blog = await Blog.create({
      title,
      content,
      author,
      status: status || 'draft',
      category: category || 'general',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Blog created successfully',
        data: blog,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Admin] Blogs POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create blog' },
      { status: 500 }
    );
  }
}
