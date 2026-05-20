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
    
    // Second pass: normalize all emails and merge duplicates
    const mergedAccounts: string[] = [];
    
    for (const [normalizedEmail, userIds] of emailMap.entries()) {
      if (userIds.length > 1) {
        // Multiple accounts with same email (different casing)
        // Keep the first user, mark others for review
        const keepUserId = userIds[0];
        for (let i = 1; i < userIds.length; i++) {
          mergedAccounts.push(`${userIds[i]} -> ${keepUserId} (${normalizedEmail})`);
        }
      }
      
      // Update all users with this normalized email to lowercase
      const updateResult = await Profile.updateMany(
        { email: { $in: users.filter(u => u.email.toLowerCase().trim() === normalizedEmail).map(u => u.email) } },
        { $set: { email: normalizedEmail } }
      );
      
      if (updateResult.modifiedCount > 0) {
        normalizedCount += updateResult.modifiedCount;
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: `Normalized ${normalizedCount} user emails.${mergedAccounts.length > 0 ? ` Found ${mergedAccounts.length} duplicate accounts (same email, different casing) - review merged accounts.` : ' No duplicates found.'}`,
      data: {
        normalized: normalizedCount,
        mergedAccounts: mergedAccounts.slice(0, 10) // Return first 10 merged accounts
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
