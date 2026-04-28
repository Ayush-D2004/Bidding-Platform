import { useEffect, useRef, useCallback } from 'react'

/**
 * Auto-reconnecting WebSocket hook with exponential backoff.
 * @param {string|null} url - WS URL to connect to (null = don't connect)
 * @param {function} onMessage - called with parsed JSON message
 * @param {object} options
 */
export function useWebSocket(url, onMessage, options = {}) {
  const {
    maxRetries = 10,
    initialDelay = 500,
    maxDelay = 30000,
  } = options

  const wsRef = useRef(null)
  const retriesRef = useRef(0)
  const retryTimeoutRef = useRef(null)
  const mountedRef = useRef(true)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    if (!url || !mountedRef.current) return

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      retriesRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current?.(data)
      } catch (e) {
        console.error('[useWebSocket] Parse error:', e)
      }
    }

    ws.onerror = (err) => {
      console.error('[useWebSocket] Error:', err)
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      if (retriesRef.current < maxRetries) {
        const delay = Math.min(initialDelay * 2 ** retriesRef.current, maxDelay)
        retriesRef.current += 1
        retryTimeoutRef.current = setTimeout(connect, delay)
      }
    }
  }, [url, maxRetries, initialDelay, maxDelay])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(retryTimeoutRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  return { send, wsRef }
}

/**
 * useInterval — calls callback every `delay` ms. Stops when delay is null.
 */
export function useInterval(callback, delay) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delay === null) return
    const id = setInterval(() => savedCallback.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}
