/**
 * Clerk Modal Guard
 * This script prevents Clerk from opening SignIn/SignUp modals when a user is already signed in.
 * It must be loaded BEFORE Clerk initializes.
 */

(function() {
  if (typeof window === 'undefined') return;

  console.log('[ClerkModalGuard] Installing protection...');

  // Set up a property descriptor to intercept Clerk assignment
  let clerkInstance = null;

  Object.defineProperty(window, 'Clerk', {
    get() {
      return clerkInstance;
    },
    set(value) {
      if (value && !clerkInstance) {
        console.log('[ClerkModalGuard] Clerk instance detected, wrapping methods...');

        // Store original methods
        const originalOpenSignIn = value.openSignIn?.bind(value);
        const originalOpenSignUp = value.openSignUp?.bind(value);

        // Wrap openSignIn - ONLY block if user is signed in
        if (originalOpenSignIn) {
          value.openSignIn = function(...args) {
            // Check if there's actually a user object with a valid ID
            if (value.user && value.user.id) {
              console.warn('[ClerkModalGuard] ⛔ Blocked openSignIn - User already signed in:', value.user.id);
              // Return a resolved promise to prevent errors
              return Promise.resolve();
            }
            console.log('[ClerkModalGuard] ✅ Allowing openSignIn - User is signed out');
            return originalOpenSignIn(...args);
          };
        }

        // Wrap openSignUp - ONLY block if user is signed in
        if (originalOpenSignUp) {
          value.openSignUp = function(...args) {
            // Check if there's actually a user object with a valid ID
            if (value.user && value.user.id) {
              console.warn('[ClerkModalGuard] ⛔ Blocked openSignUp - User already signed in:', value.user.id);
              // Return a resolved promise to prevent errors
              return Promise.resolve();
            }
            console.log('[ClerkModalGuard] ✅ Allowing openSignUp - User is signed out');
            return originalOpenSignUp(...args);
          };
        }

        console.log('[ClerkModalGuard] Protection installed successfully');
      }
      clerkInstance = value;
    },
    configurable: true,
    enumerable: true
  });

  console.log('[ClerkModalGuard] Ready and waiting for Clerk...');
})();
