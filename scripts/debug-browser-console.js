/**
 * Browser Console Debugging Script for Production Articles API
 *
 * INSTRUCTIONS:
 * 1. Log into the production site as an admin user
 * 2. Navigate to the /admin page
 * 3. Open DevTools Console (F12 or right-click > Inspect > Console)
 * 4. Copy and paste this entire script into the console
 * 5. Press Enter to run
 *
 * This will help identify why articles fail to load in production
 */

(async function debugArticlesAPI() {
  console.clear();
  console.log(
    "%c🔍 PRODUCTION ARTICLES API DEBUGGER",
    "font-size: 20px; font-weight: bold; color: #4A90E2;"
  );
  console.log("%c" + "=".repeat(60), "color: #888;");

  // Helper functions
  const log = (message, style = "") => console.log(`%c${message}`, style || "color: #333;");
  const success = (message) => console.log(`%c✅ ${message}`, "color: #27AE60; font-weight: bold;");
  const error = (message) => console.log(`%c❌ ${message}`, "color: #E74C3C; font-weight: bold;");
  const warning = (message) => console.log(`%c⚠️ ${message}`, "color: #F39C12; font-weight: bold;");
  const info = (message) => console.log(`%cℹ️ ${message}`, "color: #3498DB;");
  const section = (title) => {
    console.log("\n" + "%c" + "─".repeat(60), "color: #888;");
    console.log(`%c${title}`, "font-size: 14px; font-weight: bold; color: #2C3E50;");
    console.log("%c" + "─".repeat(60), "color: #888;");
  };

  // Get current URL and paths
  const currentUrl = window.location.href;
  const baseUrl = window.location.origin;
  const isAdmin = currentUrl.includes("/admin");
  const locale = currentUrl.match(/\/([a-z]{2})\//)?.[1] || "en";

  section("1. ENVIRONMENT CHECK");
  log(`Current URL: ${currentUrl}`);
  log(`Base URL: ${baseUrl}`);
  log(`Locale: ${locale}`);
  log(`On admin page: ${isAdmin ? "YES" : "NO"}`);

  // Check if Clerk is loaded
  section("2. CLERK AUTHENTICATION CHECK");

  if (typeof Clerk === "undefined") {
    error("Clerk is not loaded!");
    info("This means authentication is not available");
    return;
  }

  success("Clerk is loaded");

  try {
    // Check Clerk session
    const session = await Clerk.session;
    if (session) {
      success("Clerk session found");
      log(`Session ID: ${session.id}`);
      log(`User ID: ${session.userId}`);
      log(`Created: ${new Date(session.createdAt).toLocaleString()}`);
      log(`Expires: ${new Date(session.expireAt).toLocaleString()}`);

      // Check for JWT token
      const token = await session.getToken();
      if (token) {
        success("JWT token available");
        // Decode JWT to check claims (basic decode, not verification)
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          log("Token claims:");
          console.table({
            "User ID": payload.sub,
            Issued: new Date(payload.iat * 1000).toLocaleString(),
            Expires: new Date(payload.exp * 1000).toLocaleString(),
            "Is Admin": payload.publicMetadata?.isAdmin || false,
          });

          if (!payload.publicMetadata?.isAdmin) {
            warning("User does not have isAdmin: true in publicMetadata!");
            info("This is likely the root cause - user needs admin privileges");
          } else {
            success("User has admin privileges");
          }
        } catch (e) {
          warning("Could not decode JWT token");
        }
      } else {
        warning("No JWT token available");
      }

      // Check user data
      const user = Clerk.user;
      if (user) {
        log("User details:");
        console.table({
          Email: user.primaryEmailAddress?.emailAddress,
          Name: user.fullName,
          ID: user.id,
          "Is Admin (metadata)": user.publicMetadata?.isAdmin || false,
        });
      }
    } else {
      error("No active Clerk session");
      info("User is not logged in");
      return;
    }
  } catch (err) {
    error("Error checking Clerk session:");
    console.error(err);
  }

  // Check cookies
  section("3. COOKIE ANALYSIS");

  const cookies = document.cookie.split(";").reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split("=");
    acc[key] = value;
    return acc;
  }, {});

  const sessionCookie = cookies["__session"];
  const clientUat = cookies["__client_uat"];

  if (sessionCookie) {
    success("__session cookie found");
    log(`Length: ${sessionCookie.length} characters`);
  } else {
    warning("No __session cookie found");
    info("This cookie is required for server-side authentication");
  }

  if (clientUat) {
    log(`__client_uat cookie found: ${clientUat}`);
  }

  // Test API calls
  section("4. API ENDPOINT TESTS");

  // Test 1: Basic fetch without credentials
  try {
    info("Test 1: Fetch without credentials...");
    const response1 = await fetch(`${baseUrl}/api/admin/articles?includeStats=true`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (response1.ok) {
      warning("API accessible without credentials - possible issue");
      const data = await response1.json();
      console.log("Response:", data);
    } else {
      log(`Status: ${response1.status} ${response1.statusText}`);
      if (response1.status === 401) {
        success("Correctly requires authentication");
      } else {
        warning(`Unexpected status: ${response1.status}`);
      }

      try {
        const errorData = await response1.json();
        console.log("Error response:", errorData);
      } catch {
        const errorText = await response1.text();
        console.log("Error text:", errorText);
      }
    }
  } catch (err) {
    error("Fetch failed:");
    console.error(err);
  }

  // Test 2: Fetch with credentials (how the app does it)
  try {
    info("Test 2: Fetch with credentials: include...");
    const response2 = await fetch(`${baseUrl}/api/admin/articles?includeStats=true`, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    log(`Status: ${response2.status} ${response2.statusText}`);

    // Log response headers
    console.log("Response headers:");
    for (const [key, value] of response2.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    if (response2.ok) {
      success("API call successful with credentials!");
      const data = await response2.json();
      console.log("Articles data:", data);

      if (data.articles) {
        success(`Loaded ${data.articles.length} articles`);
      }
      if (data.stats) {
        log("Stats:", data.stats);
      }
    } else {
      error(`API call failed with status ${response2.status}`);

      try {
        const errorData = await response2.json();
        console.log("Error response:", errorData);

        if (errorData.error === "Unauthorized") {
          error("Authentication issue detected");
          info("Possible causes:");
          info("1. Session cookie not being sent");
          info("2. Session expired");
          info("3. User not recognized as admin");
        } else if (errorData.error?.includes("Forbidden")) {
          error("User authenticated but not authorized");
          info("User is logged in but not recognized as admin");
        }
      } catch {
        const errorText = await response2.text();
        console.log("Error text:", errorText);
      }
    }
  } catch (err) {
    error("Fetch with credentials failed:");
    console.error(err);
  }

  // Test 3: Fetch with Authorization header
  try {
    info("Test 3: Fetch with Authorization header...");
    const token = await Clerk.session?.getToken();

    if (token) {
      const response3 = await fetch(`${baseUrl}/api/admin/articles?includeStats=true`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      log(`Status: ${response3.status} ${response3.statusText}`);

      if (response3.ok) {
        success("API call successful with Bearer token!");
        const data = await response3.json();
        console.log("Articles data:", data);
      } else {
        warning("Bearer token authentication failed");
        try {
          const errorData = await response3.json();
          console.log("Error:", errorData);
        } catch {
          const errorText = await response3.text();
          console.log("Error text:", errorText);
        }
      }
    } else {
      warning("No JWT token available for Bearer auth test");
    }
  } catch (err) {
    error("Bearer token fetch failed:");
    console.error(err);
  }

  // Network analysis
  section("5. NETWORK REQUEST ANALYSIS");
  info("Check the Network tab in DevTools:");
  info('1. Filter by "articles" to find the API request');
  info("2. Click on the request to see details");
  info('3. Check the "Headers" tab:');
  info("   - Request Headers > Cookie (should contain __session)");
  info("   - Response Headers > Any error details");
  info('4. Check the "Response" tab for the actual data or error');

  // Check React component
  section("6. REACT COMPONENT CHECK");

  // Try to find the ArticleManagement component in React DevTools
  info("To debug the React component:");
  info("1. Install React Developer Tools extension");
  info("2. Open React DevTools (new tab in DevTools)");
  info('3. Search for "ArticleManagement" component');
  info("4. Check its state for error messages");

  // Recommendations
  section("7. DIAGNOSTICS SUMMARY");

  const diagnostics = {
    "Clerk Loaded": typeof Clerk !== "undefined",
    "User Logged In": !!(await Clerk.session),
    "Has Admin Metadata": Clerk.user?.publicMetadata?.isAdmin === true,
    "Session Cookie Present": !!sessionCookie,
    "API Works (no auth)": false, // Set based on test 1
    "API Works (with credentials)": false, // Set based on test 2
    "API Works (bearer token)": false, // Set based on test 3
  };

  console.table(diagnostics);

  section("8. RECOMMENDED ACTIONS");

  if (!diagnostics["Has Admin Metadata"]) {
    error("ROOT CAUSE: User does not have admin privileges");
    info("Solution:");
    info("1. Go to Clerk Dashboard > Users");
    info("2. Find your user account");
    info("3. Edit user > Public metadata");
    info('4. Add: { "isAdmin": true }');
    info("5. Save and refresh the page");
  } else if (!diagnostics["Session Cookie Present"]) {
    error("ROOT CAUSE: Session cookie missing");
    info("Solution:");
    info("1. Log out completely");
    info("2. Clear all cookies for this domain");
    info("3. Log in again");
    info("4. Check cookie settings in Clerk Dashboard");
  } else if (!diagnostics["API Works (with credentials)"]) {
    error("ROOT CAUSE: API authentication failing despite valid session");
    info("Possible solutions:");
    info("1. Check Vercel environment variables");
    info("   - CLERK_SECRET_KEY must be set");
    info("   - Must match the one in Clerk Dashboard");
    info("2. Check production domain in Clerk Dashboard");
    info(`   - ${baseUrl} must be listed`);
    info("3. Redeploy the application on Vercel");
    info("4. Check middleware.ts for auth handling issues");
  }

  console.log("\n%c" + "=".repeat(60), "color: #888;");
  success("Debugging complete! Check the analysis above.");
  info("If issues persist, share the console output with support.");
})();
