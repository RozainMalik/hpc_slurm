// src/lib/api.js
// Every request to the backend goes through api(). It attaches the access
// token, refreshes it once when it expires, and turns errors into ApiError.

const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export const auth = {
    save({ access, refresh, username }) {
        localStorage.setItem('access', access)
        localStorage.setItem('refresh', refresh)
        localStorage.setItem('username', username)
    },
    clear() {
        ;['access', 'refresh', 'username'].forEach((k) => localStorage.removeItem(k))
    },
    isLoggedIn: () => Boolean(localStorage.getItem('refresh')),
    username: () => localStorage.getItem('username') || 'admin',
}

export class ApiError extends Error {
    constructor(message, status, body = {}) {
        super(message)
        this.status = status
        this.body = body
    }
}

// Several requests can expire at once; share one refresh call between them.
let refreshing = null
function refreshAccess() {
    if (!refreshing) {
        refreshing = (async () => {
            const refresh = localStorage.getItem('refresh')
            if (!refresh) return false
            try {
                const res = await fetch(`${BASE}/token/refresh/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh }),
                })
                if (!res.ok) return false
                const data = await res.json()
                localStorage.setItem('access', data.access)
                return true
            } catch {
                return false
            }
        })().finally(() => {
            refreshing = null
        })
    }
    return refreshing
}

export async function api(path, { method = 'GET', body, retry = true } = {}) {
    const headers = { 'Content-Type': 'application/json' }
    const token = localStorage.getItem('access')
    if (token) headers.Authorization = `Bearer ${token}`

    let res
    try {
        res = await fetch(`${BASE}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        })
    } catch {
        throw new ApiError('Cannot reach the portal server. Check that the backend is running.', 0)
    }

    if (res.status === 401 && retry && path !== '/login/') {
        if (await refreshAccess()) return api(path, { method, body, retry: false })
        auth.clear()
        window.location.assign('/login')
        throw new ApiError('Your session expired. Log in again.', 401)
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.success === false) {
        throw new ApiError(data.error || data.detail || `Request failed (${res.status})`, res.status, data)
    }
    return data
}

export const enc = encodeURIComponent
