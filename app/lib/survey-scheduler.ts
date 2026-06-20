import { connectToDatabase, Survey, SurveyAssignment, Profile, Referral } from './models';
import { Types } from 'mongoose';

/**
 * Assign surveys to eligible users with priority to new users and top referrers
 */
export async function assignSurveys() {
  try {
    await connectToDatabase();
    
    // Get active or manually enabled surveys that need assignment
    const now = new Date();
    const surveys = await Survey.find({
      $or: [
        {
          status: 'active',
          scheduled_for: { $lte: now },
          expires_at: { $gt: now }
        },
        {
          is_manually_enabled: true,
          status: { $in: ['active', 'scheduled'] }
        }
      ]
    });

    if (surveys.length === 0) {
      console.log('No active surveys to assign');
      return;
    }

    for (const survey of surveys) {
      // FIXED: Get ALL users in the system - no restrictions
      const totalUsers = await Profile.countDocuments({});

      // Get users who haven't been assigned this survey
      const assignedUserIds = await SurveyAssignment.distinct('user_id', {
        survey_id: survey._id
      });

      // Get all users not yet assigned to this survey
      const usersToAssign = await Profile.find({
        _id: { $nin: assignedUserIds.map(id => new Types.ObjectId(id)) }
      }).select('_id');

      if (usersToAssign.length === 0) {
        console.log(`All users already assigned to survey "${survey.title}"`);
        continue;
      }

      // Create assignments for ALL users who aren't already assigned
      const assignments = usersToAssign.map(user => ({
        survey_id: survey._id,
        user_id: user._id,
        assigned_reason: 'auto_assigned'
      }));

      await SurveyAssignment.insertMany(assignments);
      console.log(`Assigned survey "${survey.title}" to ${assignments.length} users`);
    }
  } catch (error) {
    console.error('Error assigning surveys:', error);
  }
}

/**
 * Activate scheduled surveys (run this as a cron job every minute)
 * Checks both time-based schedule and manual enablement
 */
export async function activateScheduledSurveys() {
  try {
    await connectToDatabase();
    
    const now = new Date();
    
    // Convert to EAT (UTC+3)
    const eatTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
    const dayOfWeek = eatTime.getDay(); // 0 = Sunday, 2 = Tuesday
    const hour = eatTime.getHours();
    
    // Check if it's Tuesday 21:00 EAT
    const isTuesdaySchedule = dayOfWeek === 2 && hour === 21;
    
    // Find surveys to activate (either scheduled for now OR manually enabled)
    const surveysToActivate = await Survey.find({
      $or: [
        {
          status: 'scheduled',
          scheduled_for: { $lte: now },
          is_manually_enabled: false
        },
        {
          status: 'scheduled',
          is_manually_enabled: true
        }
      ]
    });

    for (const survey of surveysToActivate) {
      // Calculate expiration based on activation time
      const expiresAt = new Date(now);
      
      // If manually enabled, give 24 hours. If Tuesday schedule, give 2 hours
      if (survey.is_manually_enabled) {
        expiresAt.setHours(expiresAt.getHours() + 24);
      } else {
        expiresAt.setHours(expiresAt.getHours() + 2); // 2 hours for Tuesday schedule
      }

      await Survey.updateOne(
        { _id: survey._id },
        {
          status: 'active',
          activated_at: now,
          expires_at: expiresAt
        }
      );

      console.log(`Activated survey: ${survey.title} (Manual: ${survey.is_manually_enabled})`);
      
      // Assign surveys to users
      await assignSurveys();
    }

    // Also check if we should activate based on Tuesday schedule
    if (isTuesdaySchedule) {
      const scheduledSurveys = await Survey.find({
        status: 'scheduled',
        scheduled_for: { $lte: now },
        is_manually_enabled: false
      });

      if (scheduledSurveys.length > 0) {
        console.log(`Tuesday 21:00 EAT - Activating ${scheduledSurveys.length} scheduled surveys`);
      }
    }
  } catch (error) {
    console.error('Error activating surveys:', error);
  }
}

/**
 * Expire surveys that have passed their expiration time
 */
export async function expireSurveys() {
  try {
    await connectToDatabase();
    
    const now = new Date();
    
    const result = await Survey.updateMany(
      {
        status: 'active',
        expires_at: { $lte: now }
      },
      {
        status: 'completed'
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`Expired ${result.modifiedCount} surveys`);
    }
  } catch (error) {
    console.error('Error expiring surveys:', error);
  }
}

/**
 * Check and activate surveys based on schedule or manual enablement
 * This should run every minute via cron
 */
export async function processSurveySchedule() {
  console.log('Processing survey schedule...');
  await activateScheduledSurveys();
  await expireSurveys();
  console.log('Survey schedule processing complete');
}
