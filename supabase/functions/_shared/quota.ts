export async function consumeQuota(
  req: Request,
  kind: 'chat' | 'transcribe',
  units: number,
  requestLimit: number,
  unitLimit: number
): Promise<'allowed' | 'denied' | 'unavailable'> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const authorization = req.headers.get('authorization')
  if (!supabaseUrl || !anonKey || !authorization) return 'unavailable'

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_ai_quota`, {
    method: 'POST',
    headers: {
      authorization,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_kind: kind,
      p_units: Math.max(1, Math.ceil(units)),
      p_request_limit: requestLimit,
      p_unit_limit: unitLimit,
    }),
  })

  if (!response.ok) return 'unavailable'
  return (await response.json().catch(() => false)) === true ? 'allowed' : 'denied'
}

