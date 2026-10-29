import type { GeneratedArtifact, SessionSnapshot } from '@lightfield/shared';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } }); }
  catch { throw new Error('The Lightfield server could not be reached. Start the local server and try again.'); }
  if (!response.ok) {
    let message = 'The request could not be completed.';
    try { const data = await response.json() as { error?: string }; if (data.error) message = data.error; } catch { /* use safe default */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export interface SessionIndex {
  active: SessionSnapshot[];
  archives: SessionSnapshot[];
  templates: Array<{ id: string; title: string; durationMode: SessionSnapshot['durationMode'] }>;
}
export interface FallbackResponse { notice: string; restaurants: unknown[] }
export interface CreateSessionResponse { session: SessionSnapshot; presenterToken: string }

export const api = {
  listSessions: () => request<SessionIndex>('/api/sessions'),
  getSession: (id: string) => request<{ session: SessionSnapshot }>(`/api/sessions/${encodeURIComponent(id)}`),
  startSession: (input: { title: string; presenterName: string; templateId: string }) => request<CreateSessionResponse>('/api/sessions', { method: 'POST', body: JSON.stringify(input) }),
  archiveSession: (id: string, presenterToken: string) => request<{ session: SessionSnapshot }>(`/api/sessions/${encodeURIComponent(id)}/archive`, { method: 'POST', body: JSON.stringify({ presenterToken }) }),
  saveArtifact: (id: string, artifact: GeneratedArtifact, presenterToken: string) => request<{ session: SessionSnapshot }>(`/api/sessions/${encodeURIComponent(id)}/artifacts`, { method: 'POST', headers: { 'x-lightfield-presenter': presenterToken }, body: JSON.stringify(artifact) }),
  getFallback: () => request<FallbackResponse>('/api/rotator/fallback'),
};

export function makeHkuAlias(): string {
  const places = ['Pokfulam', 'Centennial', 'Sai Ying Pun', 'Lung Fu'];
  const companions = ['Panda', 'Owl', 'Otter', 'Myna', 'Dolphin', 'Kite'];
  const secureIndex = (length: number) => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % length;
  };
  return `${places[secureIndex(places.length)]} ${companions[secureIndex(companions.length)]}`;
}
