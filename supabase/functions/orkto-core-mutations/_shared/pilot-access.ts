// Works with a caller-JWT Supabase client only; never pass an admin client.
export async function verifyPilotSession(client: {
  rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }>;
}): Promise<'allowed' | 'denied' | 'unavailable'> {
  try {
    const result = await client.rpc('orkto_pilot_session_allowed');
    if (result.error) return 'unavailable';
    return result.data === true ? 'allowed' : 'denied';
  } catch { return 'unavailable'; }
}
