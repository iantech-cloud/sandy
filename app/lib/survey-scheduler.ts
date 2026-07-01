import { connectToDatabase, Survey, SurveyAssignment, Profile, Referral } from './models';
import { Types } from 'mongoose';

/**
 * Assign surveys to ALL eligible users
 * Handles both new surveys and new users joining after survey activation
 */
export async function assignSurveys() {
  try {
    await connectToDatabase();
    
    // Get ALL active surveys that haven't expired
    const now = new Date();
    const activeSurveys: any[] = await (Survey.find({
      status: 'active',
      expires_at: { $gt: now }
    }).select('_id title') as any).lean();

    if (activeSurveys.length === 0) {
      console.log('[SurveyAssignment] No active surveys to assign');
      return;
    }

    console.log(`[SurveyAssignment] Found ${activeSurveys.length} active surveys`);

    // Get all users in the system
    const allUsers: any[] = await (Profile.find({}).select('_id') as any).lean();
    console.log(`[SurveyAssignment] Total users in system: ${allUsers.length}`);

    let totalAssignmentsCreated = 0;

    for (const survey of activeSurveys) {
      try {
        // Get users who haven't been assigned this survey yet
        const assignedUserIds = await SurveyAssignment.distinct('user_id', {
          survey_id: survey._id
        });

        const usersToAssign = allUsers.filter(
          user => !assignedUserIds.includes(user._id.toString())
        );

        if (usersToAssign.length === 0) {
          console.log(`[SurveyAssignment] All users assigned to survey: ${survey.title}`);
          continue;
        }

        // Create batch assignments for all new users
        const assignments = usersToAssign.map(user => ({
          survey_id: survey._id,
          user_id: user._id.toString(),
          assigned_reason: 'auto_assigned',
          assigned_at: new Date(),
        }));

        // Insert assignments with error handling for duplicates
        await SurveyAssignment.insertMany(assignments, { ordered: false }).catch(
          (error: any) => {
            // Ignore duplicate key errors - they're expected
            if (error.code === 11000) {
              console.log(`[SurveyAssignment] Handled duplicate assignments for survey: ${survey.title}`);
            } else {
              throw error;
            }
          }
        );

        totalAssignmentsCreated += usersToAssign.length;
        console.log(
          `[SurveyAssignment] Assigned survey "${survey.title}" to ${usersToAssign.length} new users`
        );
      } catch (surveyError: any) {
        console.error(
          `[SurveyAssignment] Error assigning survey ${survey._id}:`,
          surveyError.message
        );
      }
    }

    console.log(`[SurveyAssignment] Total new assignments created: ${totalAssignmentsCreated}`);
  } catch (error: any) {
    console.error('[SurveyAssignment] Error in assignSurveys:', error);
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
    
    // Find surveys to activate (either scheduled for now OR manually enabled)
    const surveysToActivate: any[] = await (Survey.find({
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
    }).select('_id title is_manually_enabled scheduled_for') as any).lean();

    if (surveysToActivate.length === 0) {
      console.log('[SurveyActivation] No surveys to activate');
      return;
    }

    console.log(`[SurveyActivation] Activating ${surveysToActivate.length} surveys`);

    for (const survey of surveysToActivate) {
      try {
        // Calculate expiration based on activation time
        const expiresAt = new Date(now);
        
        // If manually enabled, give 12 hours. Otherwise give 2 hours (for scheduled surveys)
        if (survey.is_manually_enabled) {
          expiresAt.setHours(expiresAt.getHours() + 12); // 12-hour window for manually-enabled surveys
        } else {
          expiresAt.setHours(expiresAt.getHours() + 2); // 2-hour window for scheduled surveys
        }

        const result = await Survey.updateOne(
          { _id: survey._id },
          {
            status: 'active',
            activated_at: now,
            expires_at: expiresAt
          }
        );

        if (result.modifiedCount > 0) {
          console.log(
            `[SurveyActivation] Activated: ${survey.title} (Expires: ${expiresAt.toISOString()})`
          );
        }
      } catch (surveyError: any) {
        console.error(`[SurveyActivation] Error activating survey ${survey._id}:`, surveyError.message);
      }
    }
  } catch (error: any) {
    console.error('[SurveyActivation] Error in activateScheduledSurveys:', error);
  }
}

/**
 * Expire surveys that have passed their expiration time
 * Prevent new completions and mark as expired
 */
export async function expireSurveys() {
  try {
    await connectToDatabase();
    
    const now = new Date();
    
    const expiredSurveys: any[] = await (Survey.find({
      status: 'active',
      expires_at: { $lte: now }
    }).select('_id title expires_at') as any).lean();

    if (expiredSurveys.length === 0) {
      console.log('[SurveyExpiration] No surveys to expire');
      return;
    }

    console.log(`[SurveyExpiration] Found ${expiredSurveys.length} surveys to expire`);

    const result = await Survey.updateMany(
      {
        status: 'active',
        expires_at: { $lte: now }
      },
      {
        status: 'completed',
        expired_at: now
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[SurveyExpiration] Successfully expired ${result.modifiedCount} surveys`);
      expiredSurveys.forEach(survey => {
        console.log(
          `[SurveyExpiration] - ${survey.title} (expired at ${new Date(survey.expires_at).toISOString()})`
        );
      });
    }
  } catch (error: any) {
    console.error('[SurveyExpiration] Error expiring surveys:', error);
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
