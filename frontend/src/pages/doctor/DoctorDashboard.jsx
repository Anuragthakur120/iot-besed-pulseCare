import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Activity,
  Cpu,
  AlertTriangle,
  Search,
  Plus,
  Play,
  ArrowUpRight,
  RefreshCw,
  Heart,
  Thermometer,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useSocket } from '@/hooks/useSocket';
import api from '@/services/api';
import { Card } from '@/components/Card';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/Button';
import { StatusPill } from '@/components/StatusPill';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalPatients: 0,
    activeSessions: 0,
    devicesOnline: 0,
    totalDevices: 0,
    recentAlertsCount: 0
  });
  const [patients, setPatients] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');

  // Start Session Modal State
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [startingSession, setStartingSession] = useState(false);

  // Real-time socket for ops updates
  const { lastReading, lastAlert, deviceStatuses } = useSocket({ subscribeOps: true });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryRes, patientsRes, devicesRes] = await Promise.all([
        api.get('/api/dashboard/doctor-summary').catch(() => ({ data: { data: {} } })),
        api.get('/api/patients?limit=10').catch(() => ({ data: { data: { patients: [] } } })),
        api.get('/api/devices').catch(() => ({ data: { data: { devices: [] } } }))
      ]);

      if (summaryRes.data?.data) {
        setSummary(summaryRes.data.data);
      }
      if (patientsRes.data?.data?.patients) {
        setPatients(patientsRes.data.data.patients);
      }
      if (devicesRes.data?.data?.devices) {
        setDevices(devicesRes.data.data.devices);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Update live vitals in table when real-time reading arrives
  useEffect(() => {
    if (!lastReading) return;

    setPatients((prevPatients) =>
      prevPatients.map((p) => {
        if (p.patientId === lastReading.patientId || p._id === lastReading.patientId) {
          return {
            ...p,
            liveVitals: {
              heartRate: lastReading.heartRate,
              spo2: lastReading.spo2,
              temperatureC: lastReading.temperatureC,
              ts: lastReading.ts
            }
          };
        }
        return p;
      })
    );
  }, [lastReading]);

  // Append new alert to recent alerts feed
  useEffect(() => {
    if (!lastAlert) return;
    setRecentAlerts((prev) => [lastAlert, ...prev.slice(0, 9)]);
    addToast({
      title: `Clinical Alert: ${lastAlert.type}`,
      message: `Patient ${lastAlert.patient?.name || lastAlert.patientId}: value ${lastAlert.value ?? '--'}`,
      type: lastAlert.severity === 'critical' ? 'danger' : 'warning'
    });
  }, [lastAlert, addToast]);

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedDeviceId) {
      addToast({ title: 'Validation', message: 'Please select both a patient and device', type: 'warning' });
      return;
    }

    setStartingSession(true);
    try {
      const response = await api.post('/api/sessions', {
        patientId: selectedPatientId,
        deviceId: selectedDeviceId,
        notes: sessionNotes
      });

      addToast({
        title: 'Session Started',
        message: `Monitoring session initiated for patient with device ${selectedDeviceId}`,
        type: 'success'
      });

      setIsStartModalOpen(false);
      navigate(`/monitoring/live?sessionId=${response.data.data.session.sessionId}&patientId=${selectedPatientId}`);
    } catch (err) {
      addToast({
        title: 'Failed to Start Session',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setStartingSession(false);
    }
  };

  const filteredPatients = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.patientId?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#0c1626] p-6 rounded-2xl border border-[#E5EAF1] dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-white">
            Welcome back, {user?.name || 'Doctor'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ward & Clinical Telemetry Center • Live Patient Vitals Stream
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            isLoading={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/doctor/patients')}
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Patients</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsStartModalOpen(true)}
            className="flex items-center gap-2 shadow-sm"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start Session</span>
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monitored Patients"
          value={summary.totalPatients || patients.length}
          icon={Users}
          description="Active clinical registrations"
          trend="Registered"
        />
        <StatCard
          title="Active Sessions"
          value={summary.activeSessions || 0}
          icon={Activity}
          description="Streaming vital telemetries"
          trend={summary.activeSessions > 0 ? 'Live Telemetry' : 'Standby'}
        />
        <StatCard
          title="Hardware Devices"
          value={`${summary.devicesOnline || 1} / ${summary.totalDevices || devices.length || 2}`}
          icon={Cpu}
          description="Paired pulse bedside nodes"
          trend="Online"
        />
        <StatCard
          title="Recent Alerts"
          value={recentAlerts.length || summary.recentAlertsCount || 0}
          icon={AlertTriangle}
          description="Threshold breaches in 24h"
          trend="Under Watch"
        />
      </div>

      {/* Main Grid: Patients Table & Alerts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Monitored Patients */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-5 border-b border-[#E5EAF1] dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-500" />
                  Live Patient Roster
                </h2>
                <p className="text-xs text-slate-400">Real-time status and biometric stream</p>
              </div>

              {/* Quick Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ID, name, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-[#F6F8FB] dark:bg-slate-900 text-[#0B1F3A] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F8FB] dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-[#E5EAF1] dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-3">Patient ID</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Heart Rate</th>
                    <th className="py-3 px-3 text-right">SpO2</th>
                    <th className="py-3 px-3 text-right">Temp</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF1] dark:divide-slate-800">
                  {filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-400">
                        No patients matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPatients.map((patient) => {
                      const vitals = patient.liveVitals || patient.lastReading || {};
                      const hasVitals = vitals.heartRate || vitals.spo2;

                      return (
                        <tr
                          key={patient._id || patient.patientId}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={patient.name} size="sm" />
                              <div className="truncate">
                                <span className="font-semibold text-slate-900 dark:text-white block truncate">
                                  {patient.name}
                                </span>
                                <span className="text-[11px] text-slate-400 block truncate">
                                  {patient.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold">
                              {patient.patientId}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <StatusPill status={patient.status === 'active' ? 'LIVE' : 'IDLE'} />
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-medium tabular-nums">
                            {vitals.heartRate ? (
                              <span className="text-rose-500 font-bold">{vitals.heartRate} bpm</span>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-medium tabular-nums">
                            {vitals.spo2 ? (
                              <span className="text-teal-600 dark:text-teal-400 font-bold">{vitals.spo2}%</span>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-medium tabular-nums">
                            {vitals.temperatureC ? (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">{vitals.temperatureC}°C</span>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => navigate(`/monitoring/live?patientId=${patient.patientId}`)}
                                className="text-teal-600 dark:text-teal-400 hover:border-teal-500"
                              >
                                Live
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => navigate(`/doctor/patients/${patient.patientId}`)}
                              >
                                View
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Col: Alerts Feed & Quick Hardware Overview */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Live Ward Alerts
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                Auto-Updated
              </span>
            </div>

            {recentAlerts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                  ✓
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">All Parameters Normal</p>
                <p>No active vital threshold breaches detected.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {recentAlerts.map((alert, i) => (
                  <div
                    key={alert._id || i}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      alert.severity === 'critical'
                        ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
                        : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold tracking-tight uppercase text-[11px]">{alert.type}</span>
                      <span className="text-[10px] opacity-75">
                        {new Date(alert.triggeredAt || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Value: <strong className="font-mono">{alert.value ?? '--'}</strong> • Patient:{' '}
                      <strong>{alert.patient?.name || alert.patientId || 'Unassigned'}</strong>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Hardware Status */}
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-teal-500" />
              Connected IoT Bedside Nodes
            </h3>
            <div className="space-y-2 text-xs">
              {devices.map((d) => (
                <div
                  key={d.deviceId}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-[#E5EAF1] dark:border-slate-800"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block">
                      {d.deviceId}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{d.label || 'Bedside Node'}</span>
                  </div>
                  <div className="text-right">
                    <StatusPill status={d.currentSessionId ? 'LIVE' : d.status === 'active' ? 'IDLE' : 'OFFLINE'} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Start Session Modal */}
      <Modal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        title="Initiate Clinical Monitoring Session"
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
              {patients.map((p) => (
                <option key={p.patientId} value={p.patientId}>
                  {p.name} ({p.patientId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Bedside Hardware Device
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Choose Device --</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} disabled={d.status !== 'active' || Boolean(d.currentSessionId)}>
                  {d.deviceId} - {d.label} {d.currentSessionId ? '(In Use)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Clinical Session Notes (Optional)
            </label>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="e.g. Routine post-op continuous telemetry; monitor SpO2 closely..."
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5EAF1] dark:border-slate-800">
            <Button variant="ghost" type="button" onClick={() => setIsStartModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={startingSession}>
              Begin Telemetry Stream
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
