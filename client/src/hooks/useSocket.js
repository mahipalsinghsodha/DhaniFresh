// frontend/src/hooks/useSocket.js
// Socket.io client hook with:
//   ✅ Auto-reconnect logic
//   ✅ Auth token from memory
//   ✅ Connection state tracking

import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { getAccessToken } from '../api/axios'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

let globalSocket = null // Singleton socket instance

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState(null)
  const listenersRef = useRef({})

  // ── Connect ──────────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (globalSocket?.connected) {
      setIsConnected(true)
      return globalSocket
    }

    const token = getAccessToken()

    globalSocket = io(SOCKET_URL, {
      auth:              { token },
      withCredentials:   true,
      transports:        ['websocket', 'polling'],
      reconnection:      true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    })

    globalSocket.on('connect', () => {
      console.log('[Socket] Connected:', globalSocket.id)
      setIsConnected(true)
      setConnectionError(null)
    })

    globalSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
      setIsConnected(false)
    })

    globalSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message)
      setConnectionError(err.message)
      setIsConnected(false)
    })

    globalSocket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts')
      setIsConnected(true)
      setConnectionError(null)
    })

    globalSocket.on('auth:force_logout', (data) => {
      console.warn('[Socket] Force logout received:', data?.reason)
      window.dispatchEvent(new CustomEvent('auth:forced_logout', { detail: data }))
    })

    return globalSocket
  }, [])

  // ── Disconnect ───────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    if (globalSocket) {
      globalSocket.disconnect()
      globalSocket = null
      setIsConnected(false)
    }
  }, [])

  // ── Emit event ───────────────────────────────────────────────────────────────
  const emit = useCallback((event, data) => {
    if (!globalSocket?.connected) {
      console.warn(`[Socket] Cannot emit "${event}" — not connected`)
      return false
    }
    globalSocket.emit(event, data)
    return true
  }, [])

  // ── Listen to event ──────────────────────────────────────────────────────────
  const on = useCallback((event, handler) => {
    if (!globalSocket) return
    globalSocket.on(event, handler)
    // Track for cleanup
    if (!listenersRef.current[event]) listenersRef.current[event] = []
    listenersRef.current[event].push(handler)
  }, [])

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
