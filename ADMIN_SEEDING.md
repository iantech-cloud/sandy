# Admin User Seeding Guide

## Overview

This guide explains how to create the initial admin user for the Sandy platform using the seed script. The admin user is fully initialized, verified, and has a referral code that other users can use to join the platform.

## Admin User Details

The admin user has been configured with the following credentials:

| Field | Value |
|-------|-------|
| **Username** | Scholine |
| **Email** | Scholinesandra1@gmail.com |
| **Phone** | 254707871154 |
| **Referral Code** | SANDY001 |
| **Role** | Admin (Level 10) |
| **Status** | Active & Verified |

## Prerequisites

1. MongoDB must be running and accessible
2. `MONGODB_URI` environment variable must be set in `.env.local` or `.env`
3. Node.js and pnpm/npm must be installed

## Running the Seed Script

### Option 1: Using npm script (Recommended)

```bash
pnpm seed:admin
```

Or with npm:

```bash
npm run seed:admin
```

### Option 2: Direct execution

```bash
npx ts-node scripts/seed-admin.ts
```

## What the Script Does

The seed script creates an admin user with the following properties:

✅ **Verification Status**
- Email verified
- Phone number verified (M-Pesa)
- KYC verified
- Profile completed (100%)

✅ **Account Status**
- Active status
- Approved by system
- No approval required

✅ **Admin Privileges**
- Role: Admin
- Level: 10 (System Administrator)
- Can create referral links for new users

✅ **Referral System**
- Referral Code: `SANDY001`
- Other users can join using this code
- Share the link: `https://your-domain.com/auth/sign-up?ref=SANDY001`

## After Running the Script

### 1. Login to the Platform

Use these credentials:
- **Email**: Scholinesandra1@gmail.com
- **Password**: Admin@123456

### 2. Share Referral Link

Users can now join the platform using the referral link:
```
https://your-domain.com/auth/sign-up?ref=SANDY001
```

### 3. Important Security Steps

⚠️ **Change the admin password immediately after first login:**
1. Log in with the credentials above
2. Go to Account Settings
3. Change the password to a strong, unique password
4. Save the new password in a secure location

### 4. Additional Admin Tasks

Once logged in as admin, you can:
- Approve pending users
- Manage user accounts and statuses
- Issue additional referral codes
- View platform analytics
- Manage system settings

## Troubleshooting

### Script fails with "MONGODB_URI is not defined"

**Solution**: Ensure your `.env.local` or `.env` file contains:
```
MONGODB_URI=mongodb://username:password@host:port/database
```

### "Admin user already exists" error

**Reason**: The admin user has already been created.

**Solution**: 
- Delete the existing admin user from MongoDB first, OR
- Modify the referral code in `ADMIN_CONFIG` to create a different admin, OR
- Contact support if you need to reset the admin

### Script times out

**Reason**: MongoDB connection issue

**Solution**: 
- Check that MongoDB is running
- Verify the `MONGODB_URI` is correct
- Check network connectivity
- Increase timeout in the script if needed

## Modifying Admin Configuration

To change admin details before running the script, edit `/scripts/seed-admin.ts`:

```typescript
const ADMIN_CONFIG = {
  username: 'YourUsername',
  email: 'your-email@example.com',
  phone_number: 'your-phone-number',
  password: 'YourStrongPassword', // Change this!
  referral_id: 'YOUR_REFERRAL_CODE', // Must be unique
};
```

Then run the script again.

## Security Best Practices

1. **Change default password** immediately after first login
2. **Enable 2FA** on the admin account once available
3. **Keep referral code private** if you don't want random users joining
4. **Use strong password** with mix of uppercase, lowercase, numbers, and symbols
5. **Don't commit** admin credentials to version control

## Database Schema Notes

The admin user is created with the following MongoDB properties:

```typescript
{
  _id: UUID,
  username: 'Scholine',
  email: 'Scholinesandra1@gmail.com',
  phone_number: '254707871154',
  password: bcrypt hashed,
  referral_id: 'SANDY001',
  role: 'admin',
  status: 'active',
  is_active: true,
  is_verified: true,
  is_approved: true,
  approval_status: 'approved',
  level: 10,
  rank: 'System Administrator',
  kyc_status: 'verified',
  mpesa_number_verified: true,
  profile_completed: true,
  completion_percentage: 100,
  // ... other fields initialized
}
```

## Next Steps

1. ✅ Run the seed script
2. ✅ Log in with admin credentials
3. ✅ Change admin password
4. ✅ Share referral link with users
5. ✅ Start using the platform!

For more support or questions, contact the development team.
