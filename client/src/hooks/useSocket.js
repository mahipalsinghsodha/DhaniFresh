// frontend/src/hooks/useSocket.js
// Socket.io client hook with:
//   ✅ Auto-reconnect logic
//   ✅ Auth token from memory
//   ✅ Connection state tracking
//   ✅ Non-blocking emit buffering

import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { getAccessToken } from '../api/axios'

const SOCKET_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : '')

let globalSocket = null // Singleton socket instance
const connectionListeners = new Set()

function notifyConnectionChange(connected, error = null) {
  connectionListeners.forEach(listener => {
    try {
      listener(connected, error)
    } catch (e) {
      console.error('[Socket] Error in connection listener:', e)
    }
  })
}

export function useSocket() {
  const [isConnected, setIsConnected] = useState(!!globalSocket?.connected)
  const [connectionError, setConnectionError] = useState(null)
  const listenersRef = useRef({})

  // Subscribe this hook instance to global socket connection changes
  useEffect(() => {
    const listener = (connected, err) => {
      setIsConnected(connected)
      if (err !== undefined) setConnectionError(err)
    }
    connectionListeners.add(listener)

    // Immediate sync
    if (globalSocket) {
      setIsConnected(!!globalSocket.connected)
    }

    return () => {
      connectionListeners.delete(listener)
    }
  }, [])

  // ── Connect ──────────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    const token = getAccessToken()

    if (globalSocket?.connected) {
      if (globalSocket.auth?.token !== token) {
        globalSocket.auth = { token }
        globalSocket.disconnect().connect()
      }
      setIsConnected(true)
      notifyConnectionChange(true)
      return globalSocket
    }

    if (globalSocket && !globalSocket.connected) {
      globalSocket.auth = { token }
      globalSocket.connect()
      return globalSocket
    }

    globalSocket = io(SOCKET_URL, {
      auth: (cb) => {
        cb({ token: getAccessToken() })
      },
      withCredentials:   true,
      transports:        ['polling', 'websocket'],
      reconnection:      true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    })
    globalSocket.auth = { token }

    globalSocket.on('connect', () => {
      console.log('[Socket] Connected:', globalSocket.id)
      notifyConnectionChange(true, null)
    })

    globalSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
      notifyConnectionChange(false, null)
    })

    globalSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message)
      notifyConnectionChange(false, err.message)
    })

    globalSocket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts')
      notifyConnectionChange(true, null)
    })

    globalSocket.on('auth:force_logout', (data) => {
      console.warn('[Socket] Force logout received:', data?.reason)
      window.dispatchEvent(new CustomEvent('auth:forced_logout', { detail: data }))
    })

    return globalSocket
  }, [])

  // Auto-reconnect when auth token updates (login/refresh/logout)
  useEffect(() => {
    const handleTokenChange = () => {
      if (globalSocket) {
        const token = getAccessToken()
        globalSocket.auth = { token }
        if (token) {
          globalSocket.disconnect().connect()
        } else {
          globalSocket.disconnect()
        }
      }
    }
    window.addEventListener('auth:token_updated', handleTokenChange)
    return () => window.removeEventListener('auth:token_updated', handleTokenChange)
  }, [])

  // ── Disconnect ───────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    if (globalSocket) {
      globalSocket.disconnect()
      globalSocket = null
      setIsConnected(false)
    }
  }, [])

  // ── Emit event (Auto-buffers in Socket.io if connecting) ─────────────────────
  const emit = useCallback((event, data) => {
    const s = globalSocket || connect()
    if (!s) {
      console.warn(`[Socket] Cannot emit "${event}" — socket unavailable`)
      return false
    }
    s.emit(event, data)
    return true
  }, [connect])

  // ── Listen to event ──────────────────────────────────────────────────────────
  const on = useCallback((event, handler) => {
    const s = globalSocket || connect()
    if (!s) return
    s.on(event, handler)
    if (!listenersRef.current[event]) listenersRef.current[event] = []
    listenersRef.current[event].push(handler)
  }, [connect])

  const off = useCallback((event, handler) => {
    if (!globalSocket) return
    globalSocket.off(event, handler)
  }, [])

  // ── Cleanup listeners on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const listeners = listenersRef.current
      Object.entries(listeners).forEach(([event, handlers]) => {
        handlers.forEach(h => globalSocket?.off(event, h))
      })
      listenersRef.current = {}
    }
  }, [])

  return {
    socket: globalSocket,
    isConnected,
    connectionError,
    connect,
    disconnect,
    emit,
    on,
    off,
  }
}
