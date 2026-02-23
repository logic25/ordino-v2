const BEACON_API_URL = import.meta.env.VITE_BEACON_API_URL || 'https://web-production-44b7c.up.railway.app';

export interface BeaconSource {
  title: string;
  score: number;
  chunk_preview: string;
}

export interface BeaconChatResponse {
  response: string;
  confidence: number;
  sources: BeaconSource[];
  flow_type: string;
  cached: boolean;
  response_time_ms: number;
}

export async function askBeacon(
  message: string,
  userId: string,
  userName: string
): Promise<BeaconChatResponse> {
  const res = await fetch(`${BEACON_API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      user_id: userId,
      user_name: userName,
      space_id: 'ordino-web'
    })
  });

  if (!res.ok) {
    throw new Error(`Beacon API error: ${res.status}`);
  }

  return res.json();
}

export async function checkBeaconHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BEACON_API_URL}/`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}
