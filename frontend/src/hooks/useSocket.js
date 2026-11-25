import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

/**
 * Custom hook for Socket.IO real-time telemetry and alerts connection
 * @param {Object} options
 * @param {string} [options.patientId] - Target patient ID to subscribe to
 * @param {boolean} [options.subscribeOps] - Whether to listen to hospital operations room
 */
export function useSocket(options = {}) {
  const { patientId, subscribeOps = false } = options;
  const { accessToken, user } = useAuth();

  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastReading, setLastReading] = useState(null);
  const [lastAlert, setLastAlert] = useState(null);
  const [deviceStatuses, setDeviceStatuses] = useState({});

  useEffect(() => {
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Connect to Socket.IO server with JWT token in auth payload
    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected to telemetry gateway:', socket.id);

      if (patientId) {
        socket.emit('subscribe:patient', patientId);
      }
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket Connection Error]:', err.message);
    });

    // Listen for live readings
    socket.on('reading:new', (reading) => {
      if (!patientId || reading.patientId === patientId || reading.meta?.patientId === patientId) {
        setLastReading(reading);
      }
    });

    // Listen for real-time alerts
    socket.on('alert:new', (alert) => {
      if (!patientId || alert.patientId === patientId || alert.patient?.patientId === patientId) {
        setLastAlert(alert);
      }
    });

    // Listen for device status updates
    socket.on('device:status', (status) => {
      setDeviceStatuses((prev) => ({
        ...prev,
        [status.deviceId]: status
      }));
    });

    return () => {
      if (patientId && socket.connected) {
        socket.emit('unsubscribe:patient', patientId);
      }
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [accessToken, patientId]);

  // Subscribe dynamically to a specific patient
  const subscribeToPatient = useCallback((targetPatientId) => {
    if (socketRef.current?.connected && targetPatientId) {
      socketRef.current.emit('subscribe:patient', targetPatientId);
    }
  }, []);

  const unsubscribeFromPatient = useCallback((targetPatientId) => {
    if (socketRef.current?.connected && targetPatientId) {
      socketRef.current.emit('unsubscribe:patient', targetPatientId);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    lastReading,
    lastAlert,
    deviceStatuses,
    subscribeToPatient,
    unsubscribeFromPatient
  };
}

export default useSocket;
