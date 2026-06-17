/**
 * UsernameGenerationService
 * 
 * Intelligently generates unique, human-friendly usernames from a user's full name.
 * Similar to Google's approach, it creates memorable usernames by combining parts
 * of the user's name with optional numeric suffixes for uniqueness.
 */

import { Profile } from '@/app/lib/models';

export class UsernameGenerationService {
  /**
   * Generates a unique username from a full name.
   * Returns a promise that resolves to a unique, available username.
   * 
   * Examples:
   * - "John Doe" → "johndoe", "john.doe", "doejohn", etc.
   * - "Mary Wanjiku" → "marywanjiku", "mary.w", "wanjikumary", etc.
   */
  static async generateUniqueUsername(fullName: string): Promise<string> {
    if (!fullName || fullName.trim().length === 0) {
      throw new Error('Full name is required to generate a username');
    }

    const nameParts = fullName
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(part => part.length > 0);

    if (nameParts.length === 0) {
      throw new Error('Invalid full name provided');
    }

    // Generate candidate usernames in order of preference
    const candidates = this.generateCandidates(nameParts);

    // Check each candidate for uniqueness
    for (const candidate of candidates) {
      const exists = await Profile.findOne({ username: candidate });
      if (!exists) {
        return candidate;
      }
    }

    // If all candidates are taken, add year-based suffix
    return this.generateWithYearSuffix(nameParts);
  }

  /**
   * Generate a list of candidate usernames from name parts.
   * Ordered by preference (most human-friendly first).
   */
  private static generateCandidates(nameParts: string[]): string[] {
    const candidates: Set<string> = new Set();

    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    const middleParts = nameParts.slice(1, -1);

    // 1. Full name concatenated (most preferred)
    // "John Doe" → "johndoe"
    candidates.add(nameParts.join(''));

    // 2. First + Last with dot separator
    // "John Doe" → "john.doe"
    if (nameParts.length >= 2) {
      candidates.add(`${firstName}.${lastName}`);
    }

    // 3. Last + First concatenated
    // "John Doe" → "doejohn"
    if (nameParts.length >= 2) {
      candidates.add(`${lastName}${firstName}`);
    }

    // 4. First + Last with dot, include first initial of middle names
    // "John Smith Doe" → "john.s.doe"
    if (middleParts.length > 0) {
      const middleInitials = middleParts.map(p => p[0]).join('.');
      candidates.add(`${firstName}.${middleInitials}.${lastName}`);
    }

    // 5. First name + middle initial + year
    // "John Smith Doe" → "johns21"
    if (middleParts.length > 0) {
      const middleInitial = middleParts[0][0];
      candidates.add(`${firstName}${middleInitial}${this.getCurrentYearSuffix()}`);
    }

    // 6. First + Last with hyphen
    // "John Doe" → "john-doe"
    if (nameParts.length >= 2) {
      candidates.add(`${firstName}-${lastName}`);
    }

    // 7. First name only
    // "John" → "john"
    candidates.add(firstName);

    // 8. Last name only
    // "Doe" → "doe"
    if (nameParts.length >= 2) {
      candidates.add(lastName);
    }

    // 9. First + Last with random number (not year)
    // "John Doe" → "johndoe27"
    if (nameParts.length >= 2) {
      candidates.add(`${firstName}${lastName}${this.getRandomSuffix()}`);
    }

    // 10. First + last initial + random number
    // "John Doe" → "johnd27"
    if (nameParts.length >= 2) {
      candidates.add(`${firstName}${lastName[0]}${this.getRandomSuffix()}`);
    }

    // 11. First initial + Last name + suffix
    // "John Doe" → "jdoe21"
    if (nameParts.length >= 2) {
      candidates.add(`${firstName[0]}${lastName}${this.getCurrentYearSuffix()}`);
    }

    // 12. All initials + year
    // "John Smith Doe" → "jsd21"
    if (nameParts.length > 2) {
      const initials = nameParts.map(p => p[0]).join('');
      candidates.add(`${initials}${this.getCurrentYearSuffix()}`);
    }

    return Array.from(candidates);
  }

  /**
   * Generate a username with year-based suffix when primary candidates are taken.
   * Ensures uniqueness by adding the current year.
   */
  private static async generateWithYearSuffix(nameParts: string[]): Promise<string> {
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const year = this.getCurrentYearSuffix();

    // Try several formats with year suffix
    const yearSuffixCandidates = [
      `${firstName}${year}`,
      `${firstName}${lastName}${year}`,
      `${firstName}.${lastName}${year}`,
      `${firstName}${lastName[0]}${year}`,
    ];

    for (const candidate of yearSuffixCandidates) {
      const exists = await Profile.findOne({ username: candidate });
      if (!exists) {
        return candidate;
      }
    }

    // Last resort: use UUID-based approach
    return `${firstName}${this.getRandomSuffix(999)}`;
  }

  /**
   * Get current 2-digit year suffix (e.g., "24" for 2024, "25" for 2025).
   */
  private static getCurrentYearSuffix(): string {
    const year = new Date().getFullYear().toString();
    return year.slice(-2);
  }

  /**
   * Get a random 2-digit number for uniqueness.
   */
  private static getRandomSuffix(max: number = 99): string {
    const random = Math.floor(Math.random() * max) + 1;
    return String(random).padStart(2, '0');
  }
}
