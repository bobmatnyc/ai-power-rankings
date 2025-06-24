import type { AuthStrategy } from 'payload';
import { auth } from '@/auth';

export const nextAuthStrategy: AuthStrategy = {
  name: 'nextauth',
  authenticate: async () => {
    try {
      // Get the NextAuth session
      const session = await auth();
      
      if (!session?.user?.email) {
        return { user: null };
      }

      // Return a user object that Payload can use
      // This should match your Users collection structure
      return {
        user: {
          id: session.user.email, // Using email as ID for simplicity
          email: session.user.email,
          name: session.user.name || session.user.email,
          role: session.user.email === 'bob@matsuoka.com' ? 'admin' : 'viewer',
          collection: 'users',
        },
      };
    } catch (error) {
      console.error('NextAuth strategy error:', error);
      return { user: null };
    }
  },
};