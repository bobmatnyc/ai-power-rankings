import type { PayloadRequest } from 'payload';
import { auth } from '@/auth';

export async function payloadAuthMiddleware(req: PayloadRequest): Promise<void> {
  try {
    // Get the NextAuth session
    const session = await auth();
    
    if (session?.user?.email) {
      // Find the user in Payload
      const existingUser = await req.payload.find({
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
          authProvider: 'oauth',
          lastLoginAt: new Date().toISOString(),
        };

        const newUser = await req.payload.create({
          collection: 'users',
          data: userData,
        });
        user = newUser;
      } else {
        // Update last login time
        await req.payload.update({
          collection: 'users',
          id: user.id,
          data: {
            lastLoginAt: new Date().toISOString(),
          },
        });
      }

      // Set the user on the request for Payload to use
      req.user = {
        ...user,
        collection: 'users'
      } as any;
    }
  } catch (error) {
    console.error('Payload auth middleware error:', error);
  }
}