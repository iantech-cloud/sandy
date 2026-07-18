# Admin Email Update Guide

This document explains how to update the admin email from `scholinesandra1@gmail.com` to `hustleadmin001@gmail.com`.

## Overview

The system has been updated to use the new admin email address: **hustleadmin001@gmail.com**

Two scripts are available:
1. **seed-admin.ts** - Creates a fresh admin account with the new email
2. **migrate-admin-email.ts** - Migrates an existing admin account to the new email

## Option 1: Create New Admin Account (Fresh Start)

Use this if you're starting fresh or the old admin account doesn't exist.

### Steps:

1. Ensure environment variables are set:
   ```bash
   # Make sure your .env.local or .env has:
   MONGODB_URI=your_mongodb_connection_string
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

2. Run the seed script:
   ```bash
   pnpm seed:admin
   ```

3. You'll see output like:
   ```
   ✅ Admin user created successfully!
   ═══════════════════════════════════════════════════════
                 ADMIN USER DETAILS                        
   ═══════════════════════════════════════════════════════
      User ID:       [UUID]
      Username:      HustleAdmin
      Email:         hustleadmin001@gmail.com
      Phone:         254707871154
      Role:          admin
      Status:        active
      Referral Code: SANDY001
   ═══════════════════════════════════════════════════════
   ```

4. Login with:
   - **Email:** hustleadmin001@gmail.com
   - **Password:** Admin@123456
   - **Change password after first login!**

## Option 2: Migrate Existing Admin Account

Use this if you already have an admin account with the old email and want to keep all data.

### Steps:

1. Ensure environment variables are set (same as Option 1)

2. Run the migration script:
   ```bash
   pnpm migrate:admin-email
   ```

3. You'll see output like:
   ```
   📌 Found old admin user:
      ID: [UUID]
      Email: scholinesandra1@gmail.com
      Username: Scholine
      Role: admin
      Status: active

   🔄 Updating admin email...
   ✅ Admin email updated successfully!
   ═══════════════════════════════════════════════════════
                 ADMIN USER UPDATED                        
   ═══════════════════════════════════════════════════════
      User ID:    [UUID]
      Username:   Scholine
      Old Email:  scholinesandra1@gmail.com
      New Email:  hustleadmin001@gmail.com
      Phone:      254707871154
      Role:       admin
      Status:     active
   ═══════════════════════════════════════════════════════
   ```

4. The admin can now login with the new email address:
   - **New Email:** hustleadmin001@gmail.com
   - **Password:** (same as before)

## Admin Configuration Reference

The admin configuration in `scripts/seed-admin.ts` is:

```typescript
const ADMIN_CONFIG = {
  username: 'HustleAdmin',
  email: 'hustleadmin001@gmail.com',
  phone_number: '254707871154',
  password: 'Admin@123456',
  referral_id: 'SANDY001',
};
```

To customize these values, edit `scripts/seed-admin.ts` before running the seed command.

## What Gets Updated

### With Migration Script

When migrating the admin email, the following is transferred:
- ✅ User ID (unchanged)
- ✅ Username (unchanged)
- ✅ Email address (updated to new address)
- ✅ Phone number (unchanged)
- ✅ Admin role and permissions
- ✅ All historical data
- ✅ All referral codes
- ✅ All wallet/balance information
- ✅ All transaction history

### With Seed Script

Creates a completely new admin account with:
- New User ID
- Username: HustleAdmin
- Email: hustleadmin001@gmail.com
- Fully activated and approved status
- Empty wallet/balance (no historical data)
- Referral code: SANDY001

## Important Notes

⚠️ **Security:**
- Change the default admin password immediately after first login
- The password `Admin@123456` is only for initial setup
- Use a strong, unique password

⚠️ **Email Uniqueness:**
- The old email address will no longer be accessible for admin login
- If you use the migration script, the old email is transferred to the new one
- If you use the seed script, the old admin account still exists separately

⚠️ **Referral Code:**
- Admin referral code remains `SANDY001`
- Share this code with users who need to join via the admin's referral link

## Troubleshooting

### Script Fails with "Admin user already exists"

If running `seed:admin` fails because an admin already exists:
- Use the migration script instead: `pnpm migrate:admin-email`
- Or delete the existing admin user from the database first

### Migration Script Can't Find Old Admin

If the migration script can't find the old admin:
1. Verify the email in the database: `scholinesandra1@gmail.com`
2. Check that it has role: `admin`
3. If not found, you'll need to use the seed script to create a new admin

### New Email Already Exists

If the new email address already exists in the system:
1. Delete the conflicting user account first
2. Then run the migration or seed script

## After Completing the Update

1. **Test Login:** Verify the admin can login with the new email
2. **Check Admin Panel:** Ensure all admin functions work correctly
3. **Verify Referral Code:** Test that the SANDY001 referral link still works
4. **Notify Team:** Update any internal documentation with the new admin email

## Package.json Scripts

Two npm scripts are available:

```bash
# Create new admin account
pnpm seed:admin

# Migrate existing admin to new email
pnpm migrate:admin-email
```

Both scripts use `tsx` for TypeScript execution and automatically load environment variables.

## Questions?

If you encounter any issues during the admin email update process, please check:
1. MongoDB connection is working
2. Environment variables are set correctly
3. No duplicate email addresses exist in the database
4. Admin user has proper role: `admin`
