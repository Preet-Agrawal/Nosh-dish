const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Turns a failed response into an Error that carries status and currentDish
async function handleResponse(res) {
  const data = await res.json().catch(() => null);
  if (res.ok) return data;
  const err = new Error((data && data.message) || `Request failed (${res.status})`);
  err.status = res.status;
  err.currentDish = data && data.currentDish; // only present on 409
  throw err;
}

// fetch() itself throws (TypeError) when the server is unreachable
async function request(path, options) {
  try {
    const res = await fetch(`${API_URL}${path}`, options);
    return await handleResponse(res);
  } catch (err) {
    if (err.status) throw err; // already a proper API error
    throw new Error('Cannot reach the server. Please try again.');
  }
}

export function fetchDishes() {
  return request('/dishes');
}

export function updateDish(dishId, { dishName, isPublished, expectedVersion }) {
  return request(`/dishes/${encodeURIComponent(dishId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dishName, isPublished, expectedVersion }),
  });
}
