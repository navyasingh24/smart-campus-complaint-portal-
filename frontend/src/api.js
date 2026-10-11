// Small wrapper around fetch for calling the Express API.
// The session token lives in an httpOnly cookie that the browser sends
// automatically; the JavaScript code never sees or stores it.

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(method, path, body) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data.error || 'Request failed', data.details);
  }
  return data;
}

function toQuery(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const api = {
  me: () => request('GET', '/auth/me'),
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  register: (name, email, password) => request('POST', '/auth/register', { name, email, password }),
  logout: () => request('POST', '/auth/logout', {}),

  myComplaints: (filters) => request('GET', `/complaints${toQuery(filters)}`),
  createComplaint: (complaint) => request('POST', '/complaints', complaint),

  allComplaints: (filters) => request('GET', `/admin/complaints${toQuery(filters)}`),
  updateStatus: (id, status, adminNote) =>
    request('PATCH', `/admin/complaints/${id}/status`, { status, adminNote }),
  stats: () => request('GET', '/admin/stats'),
};
