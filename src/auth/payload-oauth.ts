import type { AuthStrategy } from 'payload';
import { auth } from '@/auth';

export const oauthStrategy: AuthStrategy = {
  name: 'oauth',
  authenticate: async ({ payload }: any) => {
    try {
      // Get the NextAuth session from the request
      const session = await auth();
      
      if (!session?.user?.email) {
        return { user: null };
      }

      // Find or create the user in Payload
      const existingUser = await payload.find({
        collection: 'users',
        where: {
          email: {
            equals: session.user.email,
          },
        },
        limit: 1,
      });

      let user = existingUser.docs[0];

      if (!user) {
        // Create new user if they don't exist
        const userData = {
          email: session.user.email,
          name: session.user.name || session.user.email,
          password: 'oauth-user', // Placeholder password for OAuth users
          role: session.user.email === 'bob@matsuoka.com' ? 'admin' : 'viewer',
        };

        const newUser = await payload.create({
          collection: 'users',
          data: userData,
        });
        user = newUser;
      }

      return { 
        user: {
          ...user,
          collection: 'users',
          _strategy: 'oauth'
        }
      };
    } catch (error) {
      console.error('OAuth authentication error:', error);
      return { user: null };
    }
  },
};