/**
 * Script to fix malformed phone numbers in the database
 * This fixes issues where phone numbers were stored with duplicate country codes
 * e.g., +254254791406 should be +254791406285
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function fixPhoneNumbers() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in environment variables');
    process.exit(1);
  }

  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const ProfileCollection = db.collection('profiles');

    // Find all profiles with malformed phone numbers
    const malformedPhones = await ProfileCollection.find({
      phone_number: /^\+?254254/  // Matches +254254... or 254254...
    }).toArray();

    console.log(`\n📱 Found ${malformedPhones.length} profiles with malformed phone numbers`);

    if (malformedPhones.length > 0) {
      for (const profile of malformedPhones) {
        const oldPhone = profile.phone_number;
        let newPhone = oldPhone;

        // Remove + prefix if present
        if (newPhone.startsWith('+')) {
          newPhone = newPhone.substring(1);
        }

        // Remove duplicate 254 at the start
        if (newPhone.startsWith('254254')) {
          newPhone = '+' + newPhone.substring(3);  // +254791406...
        } else if (newPhone.startsWith('254254')) {
          newPhone = '+254' + newPhone.substring(6);  // +254... but only if it's actually correct
        }

        // Ensure it's in the correct format
        const match = newPhone.match(/^(\+)?254(\d{9})$/);
        if (match) {
          newPhone = `+254${match[2]}`;
          
          console.log(`  ✏️  ${oldPhone} → ${newPhone}`);
          
          await ProfileCollection.updateOne(
            { _id: profile._id },
            { $set: { phone_number: newPhone } }
          );
        } else {
          console.log(`  ⚠️  ${oldPhone} - Could not parse, skipping`);
        }
      }
    }

    console.log('\n✅ Phone number migration completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

fixPhoneNumbers();
