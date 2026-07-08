import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import { Profile, connectToDatabase } from '@/app/lib/models';
import clientPromise from '@/app/lib/mongodb';
import { rateLimit, API_RATE_LIMITS, rateLimitResponse } from '@/app/lib/rate-limit';

// Environment validation
// IMPORTANT: do NOT throw at module top-level. This module is imported
// transitively by many API route handlers, and Next.js evaluates those
// modules during "Collecting page data" at build time. Throwing here would
// fail the production build whenever an env var isn't injected during that
// step (which is common on Vercel). Instead we warn and let NextAuth surface
// the error at request time if the secret is genuinely missing in runtime.
if (!process.env.NEXTAUTH_SECRET) {
  console.warn('Warning: NEXTAUTH_SECRET environment variable is not set. Auth will fail at runtime until it is configured.');
}

// For development, NEXTAUTH_URL can be inferred from NODE_ENV
// For production, it should be explicitly set in environment variables
if (!process.env.NEXTAUTH_URL) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Warning: NEXTAUTH_URL not set. CSRF validation may fail in development.');
  } else {
    console.warn('Error: NEXTAUTH_URL environment variable is required for production.');
  }
}

function generateReferralId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function getDashboardRoute(role: string): string {
  switch (role) {
    case 'admin':
    case 'super_admin':
      return '/admin';
    case 'support':
      return '/support';
    default:
      return '/dashboard';
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  adapter: MongoDBAdapter(clientPromise),
  
  // Trust the host - required for CSRF validation in development and production
  trustHost: true,
  
  // Disable CSRF protection for signout - handle it via our custom logout route instead
  csrf: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  providers: [
    // ==================== CREDENTIALS PROVIDER ====================
    Credentials({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        token2FA: { label: "2FA Code", type: "text", optional: true }
      },
      
      async authorize(credentials) {
        try {
          await connectToDatabase();
          
          // Validate input
          if (!credentials?.email || !credentials?.password) {
            console.warn('[v0] Auth attempt with missing email or password');
            return null;
          }

          const email = (credentials.email as string).trim().toLowerCase();
          const password = credentials.password as string;

          // SECURITY: Rate limit login attempts by email to prevent brute-force password attacks
          const { exceeded: loginRateLimitExceeded } = rateLimit(
            `auth:login:${email}`,
            5,  // Max 5 attempts
            5 * 60_000  // Per 5 minutes
          );
          if (loginRateLimitExceeded) {
            console.warn('[v0] Auth rate limit exceeded for email:', email);
            return null;
          }

          // Ensure password is a string
          if (typeof password !== 'string' || password.length === 0) {
            console.warn('[v0] Auth attempt with invalid password format');
            return null;
          }

          console.log('[v0] Auth attempt for email:', email);

          // Use case-insensitive query so emails stored with any casing are matched
          const user = await Profile.findOne({
            email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          }).select('+password');
          
          if (!user) {
            console.warn('[v0] Auth failed: User not found for email:', email);
            return null;
          }

          const userId = user._id?.toString();
          if (!userId) {
            console.error('[v0] Auth failed: Invalid user ID');
            return null;
          }

          // Check if user has a password (OAuth-only accounts have empty string)
          if (!user.password || user.password.trim() === '') {
            console.warn('[v0] Auth failed: OAuth-only account attempted password login:', email);
            return null;
          }

          // Validate password
          let isPasswordValid = false;
          try {
            isPasswordValid = await bcrypt.compare(password, user.password);
          } catch (bcryptError) {
            console.error('[v0] Bcrypt comparison error:', bcryptError);
            return null;
          }

          if (!isPasswordValid) {
            console.warn('[v0] Auth failed: Invalid password for email:', email);
            return null;
          }

          // Check 2FA if enabled
          if (user.twoFAEnabled && user.twoFASecret) {
            if (!credentials.token2FA) {
              console.warn('[v0] Auth failed: 2FA code required but not provided');
              return null;
            }

            const verified = speakeasy.totp.verify({
              secret: user.twoFASecret,
              encoding: 'base32',
              token: credentials.token2FA as string,
              window: 2
            });

            if (!verified) {
              console.warn('[v0] Auth failed: Invalid 2FA code');
              return null;
            }
          }
          
          // SECURITY: Check account status before issuing session
          // Only reject banned and suspended accounts
          if (user.status === 'banned' || user.status === 'suspended') {
            console.warn('[v0] Auth rejected: User account is ' + user.status, email);
            return null;
          }

          // Allow inactive/unapproved users to login - they will be redirected to appropriate flow
          // Admins bypass activation/approval checks
          if (user.role !== 'admin' && user.role !== 'super_admin') {
            // Regular users can still login even if inactive or unapproved
            // The login flow will redirect them to activation or approval page
            console.log('[v0] Auth: User account needs activation/approval', {
              email,
              is_active: user.is_active,
              is_approved: user.is_approved,
              status: user.status
            });
          }

          // Update last login
          try {
            await Profile.updateOne({ _id: user._id }, { last_login: new Date() });
          } catch (updateError) {
            console.error('[v0] Failed to update last_login:', updateError);
            // Continue anyway - this shouldn't block login
          }

          console.log('[v0] Auth successful for user:', email);

          return {
            id: userId,
            email: user.email,
            name: user.username,
            role: user.role,
            is_verified: user.is_verified,
            is_active: user.is_active,
            is_approved: user.is_approved,
            approval_status: user.approval_status,
            activation_paid_at: user.activation_paid_at,
            status: user.status,
            twoFAEnabled: user.twoFAEnabled || false,
            profile_completed: user.profile_completed || false,
            phone_number: user.phone_number || null,
            authMethod: 'credentials',
          };
          
        } catch (error: any) {
          console.error('[v0] Authorize callback error:', error?.message || error);
          return null;
        }
        },
    }),
  ],
  
  callbacks: {
    // ==================== SIGN IN CALLBACK ====================
    async signIn({ user, account }) {
      try {
        // Only credentials provider is supported
        if (account?.provider !== 'credentials') {
          return false;
        }
        return true;
      } catch (error) {
        console.error('SignIn callback error:', error);
        return false;
      }
    },

    // ==================== JWT CALLBACK ====================
    async jwt({ token, user, account, trigger, session: updateSession }) {
      try {
        if (trigger === 'update' && updateSession) {
          return { ...token, ...updateSession };
        }

        // Only make database calls on initial sign in
        if (user && (trigger === 'signIn' || !token.userId)) {
          await connectToDatabase();
          
          const lookupQuery = user.id ? { _id: user.id } : { email: user.email };
          const profile = await Profile.findOne(lookupQuery);

          if (profile) {
          const userId = profile._id.toString();
            const dashboardRoute = getDashboardRoute(profile.role);

            return {
              ...token,
              sub: userId,
              id: userId,
              userId: userId,
              email: (profile.email || '').toLowerCase(),
              name: profile.username || '',
              role: profile.role || 'user',
              dashboardRoute: dashboardRoute,
              is_verified: profile.is_verified ?? false,
              is_active: profile.is_active ?? false,
              is_approved: profile.is_approved ?? false,
              approval_status: profile.approval_status || 'pending',
              rank: profile.rank || 'Unactivated',
              activation_paid_at: profile.activation_paid_at || null,
              isActivationPaid: !!profile.activation_paid_at,
              status: profile.status || 'inactive',
              twoFAEnabled: profile.twoFAEnabled || false,
              profile_completed: profile.profile_completed || false,
              phone_number: profile.phone_number || null,
              authMethod: 'credentials',
            };
          }
        }

        // For subsequent calls, just return the existing token
        const userId = token.sub || token.userId || token.id;
        if (userId) {
          token.sub = userId;
          token.userId = userId;
          token.id = userId;
        }

        return token;
      } catch (error) {
        console.error('JWT callback error:', error);
        return token;
      }
    },

    // ==================== SESSION CALLBACK ====================
    async session({ session, token }) {
      if (!token || !token.userId) {
        return session;
      }

      const userId = token.userId;
      
      session.user.id = userId;
      session.user.email = token.email as string || '';
      session.user.name = token.name as string || '';
      session.user.role = token.role as string || 'user';
      session.user.is_verified = token.is_verified as boolean ?? false;
      session.user.is_active = token.is_active as boolean ?? false;
      session.user.is_approved = token.is_approved as boolean ?? false;
      session.user.approval_status = token.approval_status as string || 'pending';
      session.user.rank = token.rank as string || 'Unactivated';
      session.user.activation_paid_at = token.activation_paid_at 
        ? new Date(token.activation_paid_at as any) 
        : undefined;
      session.user.isActivationPaid = token.isActivationPaid as boolean ?? false;
      session.user.status = token.status as string || 'inactive';
      session.user.twoFAEnabled = token.twoFAEnabled as boolean ?? false;
      session.user.authMethod = token.authMethod as string || 'credentials';
      session.user.profile_completed = token.profile_completed as boolean ?? false;
      session.user.phone_number = token.phone_number as string || null;
      
      (session as any).dashboardRoute = token.dashboardRoute as string || '/dashboard';
      
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
});

// ==================== SERVER LOGOUT HANDLER ====================
export async function handleServerLogout() {
  try {
    // For NextAuth v5, use the signOut function we already exported
    await signOut({ redirect: false });
    
    // You can add additional server-side cleanup here if needed
    // For example: clearing custom cookies, logging, etc.
    
    return { success: true, message: 'Logged out successfully' };
  } catch (error) {
    console.error('Logout error:', error);
    throw new Error('Failed to logout');
  }
}

// ==================== TYPE DECLARATIONS ====================
declare module "next-auth" {
  interface Session {
    dashboardRoute: string;
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      is_verified: boolean;
      is_active: boolean;
      is_approved: boolean;
      approval_status: string;
      rank: string;
      activation_paid_at?: Date;
      isActivationPaid: boolean;
      status: string;
      twoFAEnabled: boolean;
      authMethod: string;
      profile_completed?: boolean;
      phone_number?: string | null;
    };
  }
  
  interface User {
    id: string;
    email: string;
    name?: string | null;
    role: string;
    is_verified: boolean;
    is_active: boolean;
    is_approved: boolean;
    approval_status: string;
    activation_paid_at?: Date;
    status: string;
    twoFAEnabled: boolean;
    profile_completed?: boolean;
    phone_number?: string | null;
    authMethod?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    role: string;
    dashboardRoute: string;
    is_verified: boolean;
    is_active: boolean;
    is_approved: boolean;
    approval_status: string;
    rank: string;
    activation_paid_at?: Date;
    isActivationPaid: boolean;
    status: string;
    twoFAEnabled: boolean;
    profile_completed?: boolean;
    phone_number?: string | null;
    authMethod: string;
  }
}
