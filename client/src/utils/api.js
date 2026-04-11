const BASE = '/api';

export class ApiError extends Error {
  constructor(status, rawMessage) {
    super(rawMessage || `Request failed: ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.userMessage = userMessageFor(status);
  }
}

function userMessageFor(status) {
  if (status === 0) return 'Network error — check your connection';
  if (status === 401) return 'Please log in again';
  if (status === 403) return "You don't have access to this";
  if (status === 404) return 'Not found';
  if (status === 409) return 'Conflict — please refresh and try again';
  if (status === 422 || status === 400) return 'Invalid input';
  if (status === 429) return 'Too many requests — slow down';
  if (status >= 500) return 'Something went wrong on our end';
  return 'Request failed';
}

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });
  } catch (networkErr) {
    throw new ApiError(0, networkErr?.message);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error);
  }

  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
