import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

let resend: Resend | null = null;

const getResendClient = () => {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

const getEmailFrom = () => {
  const fromName = process.env.EMAIL_FROM_NAME || 'HustleHub Africa';
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@hustlehubafrica.com';
  return `${fromName} <${fromAddress}>`;
};

export async function POST(request: NextRequest) {
  try {
    const { to, subject, html, text } = await request.json();

    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, and html or text' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Email service not configured - missing RESEND_API_KEY' },
        { status: 500 }
      );
    }

    // Send email using Resend
    const result = await getResendClient().emails.send({
      from: getEmailFrom(),
      to,
      subject,
      html: html || undefined,
      text: text || undefined,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    return NextResponse.json({
      success: true,
      messageId: result.data?.id,
      response: result.data,
    });

  } catch (error: any) {
    console.error('Email sending error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Optional: GET method to test email configuration
export async function GET(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          error: 'Email configuration error',
          details: 'RESEND_API_KEY is not configured',
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Email service is configured correctly (Resend)',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Email configuration error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
