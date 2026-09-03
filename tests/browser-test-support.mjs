const SUPABASE_ESM_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/**
 * Prevents browser smoke tests from depending on the availability of the
 * third-party Supabase CDN. The application only needs a session-less client
 * while each test installs its deterministic, in-memory fixture.
 */
export async function installBrowserNetworkStubs(page) {
  await page.route(SUPABASE_ESM_URL, async (route) => {
    await route.fulfill({
      contentType: "application/javascript; charset=utf-8",
      body: `
        export function createClient() {
          return {
            auth: {
              getSession: async () => ({ data: { session: null }, error: null }),
              getUser: async () => ({ data: { user: null }, error: null }),
              signInWithPassword: async () => ({ data: { user: null }, error: null }),
              signUp: async () => ({ data: { user: null }, error: null }),
              signOut: async () => ({ error: null }),
              updateUser: async () => ({ data: { user: null }, error: null })
            }
          };
        }
      `
    });
  });
}
