import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Activity,
  Heart,
  Thermometer,
  Play,
  Square,
  Pause,
  Download,
  AlertTriangle,
  Clock,
  Cpu,
  Wifi,
  WifiOff,
  Radio,
  FileText,
  Volume2,
  VolumeX,
  ChevronLeft,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSocket } from '@/hooks/useSocket';
import api from '@/services/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusPill } from '@/components/StatusPill';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function LiveMonitoringPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const queryPatientId = searchParams.get('patientId');
  const querySessionId = searchParams.get('sessionId');

  const [activeSession, setActiveSession] = useState(null);
  const [patient, setPatient] = useState(null);
  const [device, setDevice] = useState(null);
  const [devicesList, setDevicesList] = useState([]);
  const [patientsList, setPatientsList] = useState([]);

  // Telemetry buffer for charts (last 300 points)
  const [readingsBuffer, setReadingsBuffer] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isDemoActive, setIsDemoActive] = useState(false);

  // Stop session dialog state
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [stopNotes, setStopNotes] = useState('');
  const [stopping, setStopping] = useState(false);

  // Start session dialog state
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(queryPatientId || '');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [startNotes, setStartNotes] = useState('');
  const [starting, setStarting] = useState(false);

  // Elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Real-time alerts feed
  const [sessionAlerts, setSessionAlerts] = useState([]);

  // Socket connection
  const targetPatient = patient?.patientId || queryPatientId;
  const { socket, isConnected, lastReading, lastAlert } = useSocket({
    patientId: targetPatient,
    subscribeOps: true
  });

  // 1. Initial Session & Patient Lookup
  useEffect(() => {
    async function loadData() {
      try {
        const [devicesRes, patientsRes] = await Promise.all([
          api.get('/api/devices').catch(() => ({ data: { data: { devices: [] } } })),
          api.get('/api/patients?limit=50').catch(() => ({ data: { data: { patients: [] } } }))
        ]);

        if (devicesRes.data?.data?.devices) setDevicesList(devicesRes.data.data.devices);
        if (patientsRes.data?.data?.patients) setPatientsList(patientsRes.data.data.patients);

        if (querySessionId) {
          const sessionRes = await api.get(`/api/sessions/${querySessionId}`);
          if (sessionRes.data?.data?.session) {
            const s = sessionRes.data.data.session;
            setActiveSession(s);
            setPatient(s.patientId);
            setDevice({ deviceId: s.deviceId });
          }
        } else if (queryPatientId) {
          const patientRes = await api.get(`/api/patients/${queryPatientId}`);
          if (patientRes.data?.data?.patient) {
            setPatient(patientRes.data.data.patient);
          }

          // Check if patient already has an active session
          const sessionsRes = await api.get(`/api/patients/${queryPatientId}/sessions`);
          const activeS = sessionsRes.data?.data?.sessions?.find((s) => s.status === 'active');
          if (activeS) {
            setActiveSession(activeS);
            setDevice({ deviceId: activeS.deviceId });
          }
        }
      } catch (err) {
        console.error('Error loading monitoring context:', err);
      }
    }

    loadData();
  }, [querySessionId, queryPatientId]);

  // 2. Load historical readings if existing session
  useEffect(() => {
    if (!activeSession?.sessionId || !patient?.patientId) return;

    api
      .get(`/api/patients/${patient.patientId}/readings?sessionId=${activeSession.sessionId}&limit=100`)
      .then((res) => {
        if (res.data?.data?.readings?.length > 0) {
          const formatted = res.data.data.readings.map((r) => ({
            ts: new Date(r.ts).toLocaleTimeString(),
            rawTs: r.ts,
            heartRate: r.heartRate,
            spo2: r.spo2,
            temperatureC: r.temperatureC,
            fingerDetected: r.fingerDetected,
            signalQuality: r.signalQuality,
            seq: r.seq
          }));
          setReadingsBuffer(formatted);
        }
      })
      .catch(() => {});
  }, [activeSession?.sessionId, patient?.patientId]);

  // 3. Elapsed Time Counter
  useEffect(() => {
    if (activeSession?.status !== 'active') return;

    const startTimestamp = new Date(activeSession.startedAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - startTimestamp) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // 4. Ingest real-time incoming reading
  useEffect(() => {
    if (!lastReading || isPaused) return;

    // Filter to current session or patient
    if (activeSession && lastReading.sessionId && lastReading.sessionId !== activeSession.sessionId) {
      return;
    }

    const newPoint = {
      ts: new Date(lastReading.ts || Date.now()).toLocaleTimeString(),
      rawTs: lastReading.ts || new Date().toISOString(),
      heartRate: lastReading.heartRate,
      spo2: lastReading.spo2,
      temperatureC: lastReading.temperatureC,
      fingerDetected: lastReading.fingerDetected,
      signalQuality: lastReading.signalQuality,
      seq: lastReading.seq
    };

    setReadingsBuffer((prev) => {
      const next = [...prev, newPoint];
      return next.length > 300 ? next.slice(-300) : next;
    });
  }, [lastReading, isPaused, activeSession]);

  // 5. Ingest real-time alert
  useEffect(() => {
    if (!lastAlert) return;
    setSessionAlerts((prev) => [lastAlert, ...prev.slice(0, 19)]);

    if (soundEnabled && lastAlert.severity === 'critical') {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch {
        // audio blocked
      }
    }
  }, [lastAlert, soundEnabled]);

  // 6. Built-in Frontend DEMO Simulator Toggle
  useEffect(() => {
    if (!isDemoActive || !activeSession) return;

    let angle = 0;
    let localSeq = 1000;
    const demoInterval = setInterval(async () => {
      angle += 0.15;
      const baseHr = 72;
      const hr = Math.round(baseHr + Math.sin(angle) * 7 + (Math.random() - 0.5) * 3);
      const spo2 = Math.round(98 + Math.sin(angle * 0.5) * 1.5);
      const temp = Math.round((36.8 + Math.sin(angle * 0.2) * 0.3) * 10) / 10;

      // Post reading to device ingestion endpoint
      try {
        await api.post('/api/devices/ingest', {
          deviceId: activeSession.deviceId || 'PCD-0001',
          deviceKey: 'dev_pcd_0001_raw_secret_token_2026',
          heartRate: hr,
          spo2,
          temperatureC: temp,
          fingerDetected: true,
          signalQuality: 96,
          seq: localSeq++,
          isDemo: true
        });
      } catch {
        // Ignore demo failures
      }
    }, 1000);

    return () => clearInterval(demoInterval);
  }, [isDemoActive, activeSession]);

  const latestReading = readingsBuffer[readingsBuffer.length - 1] || null;

  // Format Elapsed Time
  const formatElapsedTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  // Start Session Handler
  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedDeviceId) {
      addToast({ title: 'Validation', message: 'Select both a patient and device', type: 'warning' });
      return;
    }

    setStarting(true);
    try {
      const res = await api.post('/api/sessions', {
        patientId: selectedPatientId,
        deviceId: selectedDeviceId,
        notes: startNotes
      });

      const newSession = res.data.data.session;
      setActiveSession(newSession);
      setDevice({ deviceId: selectedDeviceId });

      const matchedPatient = patientsList.find(
        (p) => p.patientId === selectedPatientId || p._id === selectedPatientId
      );
      if (matchedPatient) setPatient(matchedPatient);

      addToast({
        title: 'Monitoring Started',
        message: `Session ${newSession.sessionId} live on device ${selectedDeviceId}`,
        type: 'success'
      });

      setIsStartModalOpen(false);
    } catch (err) {
      addToast({
        title: 'Failed to Start Session',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setStarting(false);
    }
  };

  // Stop Session Handler
  const handleStopSession = async () => {
    if (!activeSession) return;
    setStopping(true);
    try {
      const res = await api.post(`/api/sessions/${activeSession.sessionId}/stop`, {
        notes: stopNotes
      });

      setActiveSession(res.data.data.session);
      setIsDemoActive(false);
      setIsStopModalOpen(false);

      addToast({
        title: 'Session Concluded',
        message: `Monitoring session ${activeSession.sessionId} stopped successfully`,
        type: 'info'
      });
    } catch (err) {
      addToast({
        title: 'Failed to Stop Session',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setStopping(false);
    }
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (readingsBuffer.length === 0) {
      addToast({ title: 'Empty Buffer', message: 'No telemetry samples to export', type: 'warning' });
      return;
    }

    const headers = ['Timestamp', 'Seq', 'HeartRate_BPM', 'SpO2_Percent', 'Temp_C', 'SignalQuality', 'FingerDetected'];
    const rows = readingsBuffer.map((r) => [
      r.rawTs,
      r.seq ?? '',
      r.heartRate ?? '',
      r.spo2 ?? '',
      r.temperatureC ?? '',
      r.signalQuality ?? '',
      r.fingerDetected ? '1' : '0'
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `pulsecare_telemetry_${patient?.patientId || 'patient'}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({ title: 'Export Generated', message: 'Telemetry CSV downloaded', type: 'success' });
  };

  const isLive = activeSession?.status === 'active';

  return (
    <div className="space-y-6">
      {/* Top Session Command Bar */}
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/doctor/dashboard')}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Return to Dashboard"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-white">
                  {patient ? patient.name : 'Clinical Telemetry Center'}
                </h1>
                {patient && (
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold">
                    {patient.patientId}
                  </span>
                )}
                <StatusPill status={isLive ? 'LIVE' : activeSession ? 'COMPLETED' : 'IDLE'} />
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span className="flex items-center gap-1.5 font-mono">
                  <Cpu className="w-3.5 h-3.5 text-teal-500" />
                  Hardware Node: <strong>{device?.deviceId || activeSession?.deviceId || 'None'}</strong>
                </span>
                {activeSession && (
                  <span className="flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-teal-500" />
                    Session: <strong>{activeSession.sessionId}</strong>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Radio
                    className={`w-3.5 h-3.5 ${
                      isConnected ? 'text-emerald-500 animate-pulse' : 'text-slate-400'
                    }`}
                  />
                  Gateway: {isConnected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>

          {/* Controls & Timer */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            {/* Live Timer Counter */}
            {isLive && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="text-slate-500 font-medium">ELAPSED:</span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatElapsedTime(elapsedSeconds)}
                </span>
              </div>
            )}

            {/* Demo Toggle */}
            {isLive && (
              <Button
                variant={isDemoActive ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setIsDemoActive((prev) => !prev)}
                className="flex items-center gap-1.5"
                title="Inject simulated MAX30102 waveform data"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isDemoActive ? 'Demo Active' : 'Start Demo Stream'}</span>
              </Button>
            )}

            {/* Audio Alarm Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="p-2"
              title={soundEnabled ? 'Mute Alarms' : 'Enable Audible Alarms'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-teal-500" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </Button>

            {/* Pause/Resume Buffer */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaused((prev) => !prev)}
              className="p-2"
              title={isPaused ? 'Resume Chart Stream' : 'Pause Chart Stream'}
            >
              {isPaused ? <Play className="w-4 h-4 text-emerald-500" /> : <Pause className="w-4 h-4" />}
            </Button>

            {/* CSV Export */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>

            {/* Start / Stop Session CTA */}
            {isLive ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsStopModalOpen(true)}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop Session</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsStartModalOpen(true)}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Monitoring</span>
              </Button>
            )}
          </div>
        </div>

        {/* Hardware Status Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#E5EAF1] dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono text-[10px] uppercase">Optical Sensor:</span>
            {latestReading?.fingerDetected ? (
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Contact OK
              </span>
            ) : (
              <span className="font-bold text-amber-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Probe Detached
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono text-[10px] uppercase">Signal Quality:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-teal-500 transition-all duration-300"
                  style={{ width: `${latestReading?.signalQuality || 0}%` }}
                />
              </div>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {latestReading?.signalQuality || 0}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono text-[10px] uppercase">Buffer Count:</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              {readingsBuffer.length} samples
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono text-[10px] uppercase">Hardware Seq:</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              #{latestReading?.seq ?? '--'}
            </span>
          </div>
        </div>
      </Card>

      {/* 3 Large Vital Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Heart Rate Card */}
        <Card className="p-6 relative overflow-hidden group border-rose-500/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Heart
                className={`w-4 h-4 text-rose-500 ${
                  isLive && latestReading?.fingerDetected ? 'animate-pulse fill-rose-500' : ''
                }`}
              />
              Heart Rate (PPG)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
              BPM
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className="text-5xl font-extrabold text-[#0B1F3A] dark:text-white font-mono tabular-nums tracking-tight">
              {latestReading?.fingerDetected && latestReading?.heartRate
                ? latestReading.heartRate
                : '--'}
            </span>
            <span className="text-sm font-semibold text-slate-400">beats / min</span>
          </div>

          <div className="pt-3 border-t border-[#E5EAF1] dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Threshold Range: 50 - 120</span>
            <span className="font-mono text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
              {latestReading?.heartRate && latestReading.heartRate > 120
                ? 'TACHYCARDIA'
                : latestReading?.heartRate && latestReading.heartRate < 50
                ? 'BRADYCARDIA'
                : 'NORMAL'}
            </span>
          </div>
        </Card>

        {/* SpO2 Card */}
        <Card className="p-6 relative overflow-hidden group border-teal-500/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-teal-500" />
              Oxygen Saturation (SpO2)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold">
              PERCENT
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className="text-5xl font-extrabold text-[#0B1F3A] dark:text-white font-mono tabular-nums tracking-tight">
              {latestReading?.fingerDetected && latestReading?.spo2 ? latestReading.spo2 : '--'}
            </span>
            <span className="text-sm font-semibold text-slate-400">%</span>
          </div>

          <div className="pt-3 border-t border-[#E5EAF1] dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Minimum Safe Limit: 92%</span>
            <span className="font-mono text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
              {latestReading?.spo2 && latestReading.spo2 < 90
                ? 'CRITICAL DESAT'
                : latestReading?.spo2 && latestReading.spo2 < 92
                ? 'LOW O2'
                : 'OPTIMAL'}
            </span>
          </div>
        </Card>

        {/* Body Temperature Card */}
        <Card className="p-6 relative overflow-hidden group border-amber-500/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-amber-500" />
              Core Body Temperature
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
              CELSIUS
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className="text-5xl font-extrabold text-[#0B1F3A] dark:text-white font-mono tabular-nums tracking-tight">
              {latestReading?.temperatureC ?? '--'}
            </span>
            <span className="text-sm font-semibold text-slate-400">°C</span>
          </div>

          <div className="pt-3 border-t border-[#E5EAF1] dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Range: 35.5 - 38.0°C</span>
            <span className="font-mono text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
              {latestReading?.temperatureC && latestReading.temperatureC > 38.0
                ? 'FEVER / HYPER'
                : latestReading?.temperatureC && latestReading.temperatureC < 35.5
                ? 'HYPOTHERMIA'
                : 'AFEBRILE'}
            </span>
          </div>
        </Card>
      </div>

      {/* Real-Time Dual Interactive Waveform Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Dual Line Chart */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-500" />
                  Real-Time Biometric Waveforms (HR & SpO2)
                </h3>
                <p className="text-xs text-slate-400">High-frequency continuous telemetry buffer</p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-rose-500 font-bold font-mono">
                  <span className="w-2.5 h-0.5 bg-rose-500 rounded" /> HR (bpm)
                </span>
                <span className="flex items-center gap-1 text-teal-500 font-bold font-mono">
                  <span className="w-2.5 h-0.5 bg-teal-500 rounded" /> SpO2 (%)
                </span>
              </div>
            </div>

            {/* Recharts Live Line Chart */}
            <div className="h-72 w-full">
              {readingsBuffer.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <Activity className="w-8 h-8 text-slate-300 animate-pulse" />
                  <p>Awaiting incoming telemetry packets...</p>
                  <p className="text-[11px] text-slate-500">
                    Connect IoT bedside hardware or click "Start Demo Stream" above.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={readingsBuffer}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="ts"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      minTickGap={30}
                    />
                    <YAxis
                      yAxisId="left"
                      domain={[40, 160]}
                      tick={{ fontSize: 10, fill: '#f43f5e' }}
                      width={35}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[70, 100]}
                      tick={{ fontSize: 10, fill: '#14b8a6' }}
                      width={35}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#0c1626',
                        borderColor: '#1e293b',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        color: '#fff'
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="heartRate"
                      name="Heart Rate"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="spo2"
                      name="SpO2"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Core Temperature Chart */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-amber-500" />
                  Body Temperature Timeline (°C)
                </h3>
                <p className="text-xs text-slate-400">DS18B20 digital thermal probe stream</p>
              </div>
            </div>

            <div className="h-44 w-full">
              {readingsBuffer.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  Awaiting temperature samples...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={readingsBuffer}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="ts"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      minTickGap={30}
                    />
                    <YAxis
                      domain={[34.0, 41.0]}
                      tick={{ fontSize: 10, fill: '#f59e0b' }}
                      width={35}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#0c1626',
                        borderColor: '#1e293b',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        color: '#fff'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="temperatureC"
                      name="Temperature (°C)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>

        {/* Right Col: Active Alarms & Live Packet Table */}
        <div className="space-y-6">
          {/* Active Alarms */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Session Alarms ({sessionAlerts.length})
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 font-semibold">
                Live
              </span>
            </div>

            {sessionAlerts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2 font-bold">
                  ✓
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">No Active Alarms</p>
                <p>Telemetry within calibrated thresholds.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {sessionAlerts.map((alert, i) => (
                  <div
                    key={alert._id || i}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      alert.severity === 'critical'
                        ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                        : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold font-mono text-[11px]">{alert.type}</span>
                      <span className="text-[10px] opacity-75 font-mono">
                        {new Date(alert.triggeredAt || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[11px]">
                      Recorded value: <strong>{alert.value ?? '--'}</strong>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Raw Packets */}
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-[#E5EAF1] dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0B1F3A] dark:text-white uppercase font-mono">
                Recent Ingested Samples
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Last 10</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#F6F8FB] dark:bg-slate-900/60 text-slate-500 uppercase font-mono text-[9px] border-b border-[#E5EAF1] dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-2 text-right">HR</th>
                    <th className="py-2 px-2 text-right">SpO2</th>
                    <th className="py-2 px-2 text-right">Temp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF1] dark:divide-slate-800 font-mono tabular-nums">
                  {readingsBuffer.slice(-10).reverse().map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-slate-400">{r.ts}</td>
                      <td className="py-2 px-2 text-right text-rose-500 font-bold">
                        {r.heartRate ?? '--'}
                      </td>
                      <td className="py-2 px-2 text-right text-teal-600 dark:text-teal-400 font-bold">
                        {r.spo2 ? `${r.spo2}%` : '--'}
                      </td>
                      <td className="py-2 px-2 text-right text-amber-600 dark:text-amber-400 font-bold">
                        {r.temperatureC ? `${r.temperatureC}°` : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* Start Session Modal */}
      <Modal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        title="Start Monitoring Session"
        size="md"
      >
        <form onSubmit={handleStartSession} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Patient
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Choose Patient --</option>
              {patientsList.map((p) => (
                <option key={p.patientId} value={p.patientId}>
                  {p.name} ({p.patientId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Hardware Device
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Choose Bedside Device --</option>
              {devicesList.map((d) => (
                <option
                  key={d.deviceId}
                  value={d.deviceId}
                  disabled={d.status !== 'active' || Boolean(d.currentSessionId)}
                >
                  {d.deviceId} - {d.label} {d.currentSessionId ? '(In Use)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Initial Notes (Optional)
            </label>
            <textarea
              value={startNotes}
              onChange={(e) => setStartNotes(e.target.value)}
              placeholder="e.g. ICU Bedside Continuous Stream"
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5EAF1] dark:border-slate-800">
            <Button variant="ghost" type="button" onClick={() => setIsStartModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={starting}>
              Launch Session
            </Button>
          </div>
        </form>
      </Modal>

      {/* Stop Session Modal */}
      <Modal
        isOpen={isStopModalOpen}
        onClose={() => setIsStopModalOpen(false)}
        title="Conclude Monitoring Session"
        size="md"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Are you sure you want to stop this live telemetry session? The bedside node will be released and session statistics will be archived.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Closing Clinical Observation (Optional)
            </label>
            <textarea
              value={stopNotes}
              onChange={(e) => setStopNotes(e.target.value)}
              placeholder="e.g. Patient stable, vitals normalized, transferred to step-down ward."
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5EAF1] dark:border-slate-800">
            <Button variant="ghost" onClick={() => setIsStopModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleStopSession} isLoading={stopping}>
              Confirm Stop Session
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
