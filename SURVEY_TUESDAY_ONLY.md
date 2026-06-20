# Survey System - Tuesday-Only Free Access Implementation

## Overview
Surveys are now **completely free** to access, but are **only available on Tuesdays**. This replaces the previous KSH 30 payment requirement.

## Changes Made

### 1. **Removed Payment Logic**
- ❌ Deleted `/app/actions/survey-payments.ts` - payment initiation file no longer needed
- ✅ Removed payment imports from surveys page
- ✅ Simplified `handleStartSurvey` to directly call survey start without payment checks

### 2. **Added Tuesday-Only Access Check**
- **File**: `app/actions/surveys.ts`
- **Helper Functions Added**:
  - `isTuesday()` - Returns true if today is Tuesday (day 2 of the week)
  - `getNextTuesdayDate()` - Calculates and returns the next Tuesday's date
- **Implementation**: In `startSurvey()` function, before allowing survey access:
  - Checks if today is Tuesday (day of week === 2)
  - If not Tuesday, returns error message with next available Tuesday date
  - Message format: "Surveys are only available on Tuesdays. Next available: [Day, Month, Date]"

### 3. **Updated UI Display**
- **File**: `app/dashboard/surveys/page.tsx`
- **Survey Cards**: Added "Available: Tuesdays Only" field to each survey card
- **Empty State**: Enhanced `loadSurveys()` function to show informative message when surveys unavailable
  - Calculates days until next Tuesday
  - Displays formatted next Tuesday date
- **Button**: Changed from "Start Survey (KES 30)" to "Start Survey"

### 4. **User Experience**
- **On Tuesdays**: Users can freely access and complete surveys
- **Other Days**: 
  - Survey list shows empty state
  - Clear message states "Surveys are only available on Tuesdays"
  - Shows next available Tuesday date
  - Each survey card displays "Available: Tuesdays Only"

## Database Schema Changes
- No schema changes needed - existing `SurveyResponse` model already tracks completion
- Weekly access is enforced at the application level (function logic)
- Users can complete one survey per Tuesday (tracked by `completed` status in SurveyResponse)

## API Changes
- **Payment Callback** (`/api/payments/coop-bank/callback`) - No longer processes survey payments
- **Remove unused imports**: Survey payment callback import removed from callback route

## Testing
To verify the implementation:
1. On Tuesday: Should see available surveys, able to start them
2. On other days: Should see "Surveys only available on Tuesdays" message with next Tuesday date
3. After completing survey: `status` field in SurveyResponse marked as "completed"

## Future Enhancements
- Add configuration for survey availability day (currently hardcoded to Tuesday)
- Add admin panel to override availability schedule
- Add time-based availability (e.g., "Tuesdays 9 PM - 11 PM EAT only")
- Track survey completions per week to ensure one survey per week per user
