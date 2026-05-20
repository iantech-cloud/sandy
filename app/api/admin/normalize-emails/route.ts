import { NextResponse } from 'next/server';
import { connectToDatabase, Profile } from '@/app/lib/models';

export async function POST() {
  try {
    await connectToDatabase();
    
    // Find all users and normalize their emails
    const users = await Profile.find({});
    let normalizedCount = 0;
    let duplicateCount = 0;
    const duplicates: string[] = [];
    
    // First pass: identify duplicates that would be created by normalization
    const emailMap = new Map<string, string[]>();
    
    for (const user of users) {
      const normalized = user.email.toLowerCase().trim();
      if (!emailMap.has(normalized)) {
        emailMap.set(normalized, []);
      }
      emailMap.get(normalized)!.push(user._id);
    }
    
    // Find duplicates
    for (const [normalizedEmail, userIds] of emailMap.entries()) {
      if (userIds.length > 1) {
        duplicates.push(normalizedEmail);
        duplicateCount += userIds.length - 1;
      }
    }
    
    // Second pass: normalize emails (skip the duplicates for now - they need manual review)
    for (const user of users) {
      const normalizedEmail = user.email.toLowerCase().trim();
      const dupKey = emailMap.get(normalizedEmail);
      
      // Only normalize if this is the first user with this normalized email
      // (Skip if there are duplicates - these need admin review)
      if (dupKey && dupKey.length === 1 && user.email !== normalizedEmail) {
        user.email = normalizedEmail;
        await user.save();
        normalizedCount++;
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: `Normalized ${normalizedCount} user emails. Found ${duplicateCount} duplicate emails that need manual review.`,
      data: {
        normalized: normalizedCount,
        duplicates: {
          count: duplicateCount,
          emails: duplicates.slice(0, 10) // Return first 10 duplicates
        }
      }
    });
  } catch (error) {
    console.error('Error normalizing emails:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to normalize emails'
    }, { status: 500 });
  }
}
