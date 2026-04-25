export function getToken() {
  return sessionStorage.getItem('scout-token')
}

export function setToken(token) {
  sessionStorage.setItem('scout-token', token)
}

export function clearAuth() {
  sessionStorage.removeItem('scout-token')
  sessionStorage.removeItem('scout-user')
}

export async function apiFetch(url, options = {}) {
  const token = getToken()
  const headers = { ...(options.headers || {}) }
  if (!(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) clearAuth()
  return res
}
