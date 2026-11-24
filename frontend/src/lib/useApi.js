// src/lib/useApi.js
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

/**
 * Load data from a GET endpoint.
 *   const { data, loading, error, reload } = useApi('/qos/')
 * interval (ms) re-fetches in the background, for live views.
 */
export function useApi(path, { interval } = {}) {
    const [state, setState] = useState({ data: null, loading: true, error: null })

    const load = useCallback(async () => {
        try {
            const res = await api(path)
            setState({ data: res.data, loading: false, error: null })
        } catch (e) {
            setState((s) => ({ ...s, loading: false, error: e.message }))
        }
    }, [path])

    useEffect(() => {
        load()
        if (!interval) return
        const id = setInterval(load, interval)
        return () => clearInterval(id)
    }, [load, interval])

    return { ...state, reload: load }
}
