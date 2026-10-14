/**
 * Checks pilot access using a caller-JWT Supabase client. Never pass an admin client.
 * @param {{ rpc: (name: string) => PromiseLike<{ data: unknown, error: unknown }> }} client
 * @returns {Promise<'allowed' | 'denied' | 'unavailable'>}
 */
export async function verifyPilotSession(client) {
  try {
    const result = await client.rpc('orkto_pilot_session_allowed');
    if (result.error) return 'unavailable';
    return result.data === true ? 'allowed' : 'denied';
  } catch {
    return 'unavailable';
  }
}
