import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  Activity,
  Thermometer,
  Calendar,
  FileText,
  ShieldCheck,
  Phone,
  Clock,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import api from '@/services/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { StatusPill } from '@/components/StatusPill';

export default function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [vitalsState, setVitalsState] = useState({
    status: 'NO_DATA', // 'LIVE' | 'HISTORICAL' | 'STALE' | 'NO_DATA'
    heartRate: null,
    spo2: null,
    temperatureC: null,
    lastUpdated: null
  });

  // Socket connection subscribed to this patient's private telemetry channel
  const { isConnected, lastReading, lastAlert } = useSocket({
    patientId: user?.patientId
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [userRes, sessionsRes, notesRes] = await Promise.all([
        api.get('/api/auth/me').catch(() => ({ data: { data: { user: null } } })),
        api.get(`/api/patients/${user?.patientId}/sessions`).catch(() => ({ data: { data: { sessions: [] } } })),
        api.get(`/api/patients/${user?.patientId}/notes`).catch(() => ({ data: { data: { notes: [] } } }))
      ]);

      if (userRes.data?.data?.user) {
        setProfile(userRes.data.data.user);
      }
      if (sessionsRes.data?.data?.sessions) {
        setSessions(sessionsRes.data.data.sessions);
      }
      if (notesRes.data?.data?.notes) {
        setNotes(notesRes.data.data.notes);
      }

      // Fetch latest historical readings
      const readingsRes = await api
        .get(`/api/patients/${user?.patientId}/readings?limit=1`)
        .catch(() => ({ data: { data: { readings: [] } } }));

      if (readingsRes.data?.data?.readings?.length > 0) {
        const r = readingsRes.data.data.readings[0];
        setVitalsState({
          status: 'HISTORICAL',
          heartRate: r.heartRate,
          spo2: r.spo2,
          temperatureC: r.temperatureC,
          lastUpdated: r.ts
        });
      }
    } catch (err) {
      console.error('Failed to load patient dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.patientId) {
      fetchDashboardData();
    }
  }, [user?.patientId]);

  // Update vitals when real-time reading arrives over socket
  useEffect(() => {
    if (!lastReading) return;

    setVitalsState({
      status: 'LIVE',
      heartRate: lastReading.heartRate,
      spo2: lastReading.spo2,
      temperatureC: lastReading.temperatureC,
      lastUpdated: lastReading.ts || new Date().toISOString()
    });
  }, [lastReading]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#0c1626] p-6 rounded-2xl border border-[#E5EAF1] dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar name={user?.name} size="lg" className="w-14 h-14 ring-2 ring-teal-500/20" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-white">
                Hello, {user?.name}
              </h1>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-bold">
                {user?.patientId}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              PulseCare Patient Portal • Continuous Bedside Telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchDashboardData} isLoading={loading}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/profile')}>
            Profile & Settings
          </Button>
        </div>
      </div>

      {/* 3 Prominent Vital Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Heart Rate Card */}
        <Card className="p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Heart Rate (Pulse)
            </span>
            <div className="flex items-center gap-2">
              <StatusPill status={vitalsState.status} />
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <Heart
                  className={`w-5 h-5 ${
                    vitalsState.status === 'LIVE' ? 'animate-pulse text-rose-500 fill-rose-500' : ''
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className="text-4xl font-extrabold text-[#0B1F3A] dark:text-white font-mono tabular-nums">
              {vitalsState.heartRate ?? '--'}
            </span>
            <span className="text-sm font-semibold text-slate-400">bpm</span>
          </div>

          <div className="pt-3 border-t border-[#E5EAF1] dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Normal range: 60 - 100</span>
            {vitalsState.lastUpdated && (
              <span className="font-mono text-[10px]">
                {new Date(vitalsState.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
        </Card>

        {/* SpO2 Card */}
        <Card className="p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Oxygen Saturation (SpO2)
            </span>
            <div className="flex items-center gap-2">
              <StatusPill status={vitalsState.status} />
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className="text-4xl font-extrabold text-[#0B1F3A] dark:text-white font-mono tabular-nums">
              {vitalsState.spo2 ?? '--'}
            </span>
            <span className="text-sm font-semibold text-slate-400">%</span>
          </div>

          <div className="pt-3 border-t border-[#E5EAF1] dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Normal range: 95 - 100%</span>
            {vitalsState.lastUpdated && (
              <span className="font-mono text-[10px]">
                {new Date(vitalsState.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
        </Card>

        {/* Temperature Card */}
        <Card className="p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Body Temperature
            </span>
            <div className="flex items-center gap-2">
              <StatusPill status={vitalsState.status} />
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Thermometer className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className="text-4xl font-extrabold text-[#0B1F3A] dark:text-white font-mono tabular-nums">
              {vitalsState.temperatureC ?? '--'}
            </span>
            <span className="text-sm font-semibold text-slate-400">°C</span>
          </div>

          <div className="pt-3 border-t border-[#E5EAF1] dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Normal range: 36.5 - 37.5°C</span>
            {vitalsState.lastUpdated && (
              <span className="font-mono text-[10px]">
                {new Date(vitalsState.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* Grid: Doctor Notes & Visits History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Doctor Notes */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-500" />
                Notes From Your Care Team
              </h2>
              <span className="text-xs text-slate-400">{notes.length} observations</span>
            </div>

            {notes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No clinical notes published to your portal yet.
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note._id}
                    className="p-4 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-white">
                        {note.authorId?.name || 'Attending Physician'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Col: Emergency Contact & Quick Visits */}
        <div className="space-y-4">
          {/* Emergency Contact */}
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-500" />
              Designated Emergency Contact
            </h3>
            {user?.emergencyContact?.name ? (
              <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 text-xs space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">{user.emergencyContact.name}</p>
                <p className="text-slate-500 font-mono text-[11px] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-teal-600" />
                  {user.emergencyContact.phone || '--'}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No emergency contact configured.</p>
            )}
          </Card>

          {/* Recent Monitoring Sessions */}
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-500" />
              Recent Monitoring Sessions
            </h3>
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No past sessions recorded.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {sessions.slice(0, 4).map((s) => (
                  <div
                    key={s._id || s.sessionId}
                    className="p-3 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-bold block text-slate-800 dark:text-slate-200">
                        {s.sessionId}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(s.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <StatusPill status={s.status === 'active' ? 'LIVE' : 'COMPLETED'} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
