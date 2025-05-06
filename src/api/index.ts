const API_BASE = '';

export default {
  post: async <T = unknown>(path: string, body: T) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API POST ${path} failed: ${res.status}`);
    return res.json();
  },
}; 