const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: (token) => request('/auth/me', { token }),

  listEvents: (query = '') => request(`/events${query}`),
  getEvent: (id) => request(`/events/${id}`),
  createEvent: (body, token) => request('/events', { method: 'POST', body, token }),

  listVenues: (token) => request('/venues', { token }),
  createVenue: (body, token) => request('/venues', { method: 'POST', body, token }),

  holdSeats: (body, token) => request('/bookings/hold', { method: 'POST', body, token }),
  releaseSeats: (body, token) => request('/bookings/release', { method: 'POST', body, token }),
  confirmBooking: (body, token) => request('/bookings/confirm', { method: 'POST', body, token }),
  cancelBooking: (id, token) => request(`/bookings/${id}/cancel`, { method: 'POST', token }),
  bookingHistory: (token) => request('/bookings/history', { token }),

  joinWaitlist: (body, token) => request('/waitlist/join', { method: 'POST', body, token }),
  getOffer: (offerToken) => request(`/waitlist/offer/${offerToken}`),
  claimOffer: (offerToken, token) => request(`/waitlist/offer/${offerToken}/claim`, { method: 'POST', token }),

  myEvents: (token) => request('/organiser/events', { token }),
  eventSummary: (eventId, token) => request(`/organiser/events/${eventId}/summary`, { token }),
};

export { API_URL };
