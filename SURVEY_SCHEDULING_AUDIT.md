# Survey Scheduling System Audit

## Current Implementation Status

### ✓ IMPLEMENTED
1. **Tuesday-Only Access** - `startSurvey()` checks `isTuesday()` before allowing survey start
2. **Survey Model Schema** - Includes `scheduled_for`, `activated_at`, `expires_at`, `is_manually_enabled` fields
3. **Helper Functions** - `isTuesday()` and `getNextTuesdayDate()` in surveys.ts
4. **Survey Scheduler Module** - Located at `app/lib/survey-scheduler.ts` with:
   - `assignSurveys()` - Assigns all surveys to all users
   - `activateScheduledSurveys()` - Activates surveys based on schedule/manual enable
   - `expireSurveys()` - Expires surveys past expiration time

### ⚠️ ISSUES FOUND

1. **No Automatic Trigger Mechanism**
   - Survey scheduler functions exist but are NEVER called automatically
   - No cron job configuration
   - No API endpoint to trigger scheduler
   - Requires manual invocation

2. **getAvailableSurveys() Missing Tuesday Check**
   - Function lists surveys on ANY day (should only list on Tuesdays)
   - Only `startSurvey()` has Tuesday check, creating UX confusion
   - Users see surveys but can't start them (until Tuesday)

3. **Scheduler Logic Issues**
   - `activateScheduledSurveys()` only activates surveys with `status: 'scheduled'`
   - Active surveys are never assigned to new users
   - Assignment only happens during activation

4. **Timezone Handling**
   - Scheduler uses Africa/Nairobi timezone (EAT)
   - But Tuesday check in actions uses local browser time
   - Potential mismatch between scheduler and client

5. **Survey Assignment Flow**
   - Assignments only created when survey activated
   - New users joining after activation don't get assigned
   - No re-assignment mechanism for new users

## Recommended Fixes

1. Create API endpoint: POST `/api/cron/surveys/schedule` to trigger scheduler
2. Add Tuesday check to `getAvailableSurveys()` to match `startSurvey()`
3. Update scheduler to handle ongoing user assignments
4. Standardize timezone handling (use consistent approach everywhere)
5. Implement automated cron job (Vercel Cron or external)

## Testing Checklist

- [ ] Surveys only appear on Tuesdays in UI
- [ ] Surveys are automatically activated at scheduled time
- [ ] All users receive survey assignments
- [ ] Survey expires correctly after time window
- [ ] Earnings tracked correctly per completion
- [ ] Non-Tuesday attempts properly rejected

