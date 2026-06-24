# Survey Wallet & Earnings System - Complete Implementation

## Overview
Implemented a comprehensive survey wallet and earnings tracking system where users earn KSH 10 for each survey completion, can track earnings, and withdraw funds when reaching the minimum threshold of KSH 200.

## Key Changes

### 1. **Fixed Survey Payout Logic** (`app/actions/surveys.ts`)
- **Updated payout**: Changed from variable `survey.payout_cents` to fixed **KSH 10 (1000 cents)** per survey
- **Completion reward**: Users earn KSH 10 regardless of answer correctness (all correct, partial correct, or wrong answer)
- **Wrong answer handling**: 
  - Previously ended survey with no payment
  - Now: Ends survey but still credits KSH 10
  - Added proper transaction records for all outcomes
- **Completion scenarios**:
  - ✓ All correct answers → KSH 10 + Perfect score badge
  - ✓ Partial correct → KSH 10 + Score percentage
  - ✓ Wrong answer (first mistake) → KSH 10 + Participation credit
  - ✓ Timeout → No payment (user ran out of time)

### 2. **Survey Wallet Actions** (`app/actions/survey-wallet.ts` - NEW)
Created dedicated action file for survey earnings tracking:
- `getSurveyWallet()`: Fetches total earnings, completed surveys, available balance, and withdrawal eligibility
- `getSurveyTransactions()`: Retrieves transaction history with survey details, scores, and dates
- Helper function: `findProfileByEmail()` - consistent with existing patterns

### 3. **Survey Wallet UI Component** (`app/ui/dashboard/SurveyWalletCard.tsx` - NEW)
Beautiful, responsive card component displaying:
- **Total Earned**: Lifetime survey earnings
- **Surveys Done**: Count of completed surveys
- **Available Balance**: Current wallet balance
- **Per Survey**: Fixed KSH 10 earning amount
- **Withdrawal Status**: 
  - Shows "Can withdraw" message when balance >= KSH 200
  - Shows progress toward minimum when below threshold
  - Calculates surveys needed to reach minimum
- **Last Survey Date**: When user last completed a survey
- **Action Button**: Direct link to surveys dashboard

### 4. **Dashboard Integration** (`app/dashboard/page.tsx`)
- Imported `SurveyWalletCard` component
- Added survey wallet card to dashboard's quick actions grid
- Positioned alongside Spin-to-Win and Referral cards
- Displays real-time survey earnings data

### 5. **Earnings Overview Update** (`app/dashboard/earnings-overview/page.tsx`)
Updated survey earning stream information:
- **Commission**: Changed to "Keep 100%" (users keep all earnings)
- **Potential**: Updated to "KES 10/survey" (accurate reflection)
- **Description**: "Complete surveys every Tuesday"
- **Already listed**: Surveys already in the 9 earning streams

### 6. **Transaction Recording**
All survey completions create proper transaction records:
- **Type**: SURVEY
- **Amount**: Fixed 1000 cents (KSH 10)
- **Metadata**: Includes survey_id, response_id, score, time_taken, all_correct status
- **Status**: Marked as "completed" for all successful submissions
- **Description**: Detailed reason (e.g., "Survey completion: [title] - All correct" or "Survey submitted: [title] - Wrong answer")

### 7. **Earning Records**
Created `Earning` records alongside transactions for analytics:
- Tracks survey type earnings separately
- Includes score information
- Useful for earnings reports and user analytics

## Database Schema
No new database tables required. Changes made to existing collections:

### Profile Model
- Already has `balance_cents` field (used for main balance)
- Uses `total_earnings_cents` for lifetime earnings tracking
- `survey_wallet_cents` field was added but surveys now use main `balance_cents`

### Transaction Collection
- Type: "SURVEY" (already in enum)
- Amount: Fixed 1000 cents per transaction
- Status: "completed" for all submissions
- Metadata: Contains survey-specific details

## Withdrawal System
- **Minimum**: KSH 200 (20,000 cents)
- **Eligibility**: User can withdraw when `balance_cents >= 20000`
- **UI Feedback**: SurveyWalletCard shows progress toward minimum
- **Processing**: Uses existing withdrawal system in `/dashboard/wallet`

## Tuesday-Only Access
Surveys remain accessible only on Tuesdays:
- Check implemented in `startSurvey()` function
- Returns friendly message with next Tuesday date if attempted on other days
- UI displays "Tuesdays Only" on each survey card
- Dashboard shows helpful message on non-Tuesday days

## Payment System Removed
✓ Removed `survey-payments.ts` file  
✓ Removed payment callback handling from Co-op Bank callback route  
✓ Surveys are now completely free to access (only Tuesday restriction)  
✓ No STK push or Coop Bank integration for survey access  

## User Experience Flow

### Completing a Survey
1. User views surveys on Tuesday
2. Clicks "Start Survey"
3. Answers questions (KSH 10 earned regardless of correctness)
4. Submits answers
5. Receives feedback:
   - If all correct: "Survey completed! KES 10 added to balance"
   - If partial: "Survey submitted! Scored X%. KES 10 added to balance"
   - If wrong: "Incorrect answer. KES 10 earned for your attempt"
6. Earns KSH 10 instantly to available balance

### Tracking Earnings
1. View SurveyWalletCard on dashboard
2. See total lifetime survey earnings
3. See number of surveys completed
4. Track progress toward KSH 200 withdrawal minimum
5. View last survey completion date

### Withdrawing Earnings
1. When balance reaches KSH 200+
2. Navigate to `/dashboard/wallet`
3. Initiate withdrawal
4. Funds processed via M-Pesa

## Testing Checklist
- ✓ Build passes TypeScript compilation
- ✓ Production build succeeds
- ✓ Survey completion records KSH 10 transaction
- ✓ Wrong answer still awards KSH 10
- ✓ Timeout scenario (no payment) works
- ✓ SurveyWalletCard displays correctly
- ✓ Withdrawal eligibility checks work
- ✓ Transaction history loads properly
- ✓ Dashboard integration functional

## Code Quality
- Follows existing patterns and conventions
- Proper error handling with user-friendly messages
- TypeScript types properly defined
- Database queries optimized with lean()
- Responsive UI component with Tailwind CSS
- No breaking changes to existing functionality

## Future Enhancements
- Survey difficulty tiers with variable payouts
- Bonus multipliers for completing multiple surveys
- Leaderboard for top survey completers
- Survey analytics dashboard for admins
- Automated weekly survey scheduling
