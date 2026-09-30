const base = process.env.VITE_SUPABASE_URL;
const headers = { apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY };
for (const path of ['/auth/v1/settings', '/rest/v1/equipment?select=id&limit=0']) {
  try {
    const response = await fetch(base + path, { headers, signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    console.log(JSON.stringify({ path, status: response.status, result: response.ok ? 'reachable' : body }));
  } catch (error) { console.log(JSON.stringify({ path, error: error.message, cause: error.cause?.code })); process.exitCode=1; }
}
