import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  Filter,
  Volume2,
  VolumeX,
  Search,
  RefreshCw,
  FileText,
  User,
  Activity,
  HeartPulse
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { socket } from '@/services/socket';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { playAlertBeep, isAudioMuted, setAudioMuted, triggerBrowserNotification } from '@/utils/audioAlert';

export function AlertsPage() {
  const { user } = useAuth();
  const isDoctorOrAdmin = user?.role === 'doctor' || user?.role === 'admin';

  const [activeTab, setActiveTab] = useState('open'); // 'open' | 'acknowledged' | 'all'
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ open: 0, critical: 0, total: 0 });
  const [muted, setMutedState] = useState(isAudioMuted());

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');

  // Acknowledge Modal
  const [ackModalAlert, setAckModalAlert] = useState(null);
  const [ackNote, setAckNote] = useState('');
  const [ackSubmitting, setAckSubmitting] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setAudioMuted(next);
  };

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeTab !== 'all') {
        params.append('status', activeTab);
      }
      if (selectedType !== 'all') {
        params.append('type', selectedType);
      }
      if (selectedSeverity !== 'all') {
        params.append('severity', selectedSeverity);
      }

      const res = await api.get(`/alerts?${params.toString()}`);
      if (res.data?.success) {
        setAlerts(res.data.data.alerts || []);
        setStats({
          open: res.data.data.stats?.open || 0,
          critical: res.data.data.stats?.critical || 0,
          total: res.data.data.pagination?.total || 0
        });
      }
    } catch (err) {
      console.error('[AlertsPage] Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [activeTab, selectedType, selectedSeverity]);

  // Real-time Socket.IO Listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewAlert = (newAlert) => {
      // Play audio chime and trigger browser notification
      playAlertBeep(newAlert.severity);
      triggerBrowserNotification(newAlert);

      // Prepend to alerts list
      setAlerts((prev) => [newAlert, ...prev]);
      setStats((prev) => ({
        ...prev,
        open: prev.open + 1,
        critical: newAlert.severity === 'critical' ? prev.critical + 1 : prev.critical
      }));
    };

    const handleUpdatedAlert = (updatedAlert) => {
      setAlerts((prev) =>
        prev.map((a) => (a._id === updatedAlert._id ? { ...a, ...updatedAlert } : a))
      );
    };

    const handleResolvedAlert = (resolvedAlert) => {
      setAlerts((prev) =>
        prev.map((a) => (a._id === resolvedAlert._id ? { ...a, ...resolvedAlert } : a))
      );
      setStats((prev) => ({
        ...prev,
        open: Math.max(0, prev.open - 1)
      }));
    };

    socket.on('alert:new', handleNewAlert);
    socket.on('alert:updated', handleUpdatedAlert);
    socket.on('alert:resolved', handleResolvedAlert);

    return () => {
      socket.off('alert:new', handleNewAlert);
      socket.off('alert:updated', handleUpdatedAlert);
      socket.off('alert:resolved', handleResolvedAlert);
    };
  }, []);

  const handleAcknowledge = async () => {
    if (!ackModalAlert) return;
    try {
      setAckSubmitting(true);
      const res = await api.post(`/alerts/${ackModalAlert._id}/acknowledge`, {
        note: ackNote.trim() || undefined
      });
      if (res.data?.success) {
        setAlerts((prev) =>
          prev.map((a) => (a._id === ackModalAlert._id ? res.data.data.alert : a))
        );
        setAckModalAlert(null);
        setAckNote('');
      }
    } catch (err) {
      console.error('[AlertsPage] Acknowledge error:', err);
    } finally {
      setAckSubmitting(false);
    }
  };

  // Filtered client-side search
  const filteredAlerts = alerts.filter((a) => {
    if (!search) return true;
    const query = search.toLowerCase();
    const patientName = a.patient?.name?.toLowerCase() || '';
    const patientId = a.patient?.patientId?.toLowerCase() || '';
    const alertType = a.type.toLowerCase();
    return patientName.includes(query) || patientId.includes(query) || alertType.includes(query);
  });

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-white flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            {isDoctorOrAdmin ? 'Clinical Telemetry Alarms' : 'My Health Alerts & Notifications'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isDoctorOrAdmin
              ? 'Real-time physiological threshold breach tracking, debounced persistence alarms, and clinician acknowledgments.'
              : 'Continuous updates on your vital readings and hardware status in plain, transparent language.'}
          </p>
        </div>

        {/* Audio Mute & Refresh controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleMute}
            className="flex items-center gap-2 text-xs"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-teal-600" />}
            <span>{muted ? 'Audio Muted' : 'Audio Active'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlerts}
            className="flex items-center gap-2 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4 border-l-4 border-rose-500">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Critical Alarms</p>
            <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">{stats.critical}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 border-l-4 border-amber-500">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Open / Active Alarms</p>
            <p className="text-2xl font-bold font-mono text-[#0B1F3A] dark:text-white">{stats.open}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 border-l-4 border-teal-500">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Recorded Alarms</p>
            <p className="text-2xl font-bold font-mono text-teal-600 dark:text-teal-400">{stats.total}</p>
          </div>
        </Card>
      </div>

      {/* Filter and Tab Bar */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5EAF1] dark:border-slate-800 pb-3">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            {[
              { id: 'open', label: 'Open Alarms' },
              { id: 'acknowledged', label: 'Acknowledged' },
              { id: 'all', label: 'All History' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {isDoctorOrAdmin && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter patient..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-teal-500"
                />
              </div>
            )}

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Alert Types</option>
              <option value="HR_HIGH">High Heart Rate</option>
              <option value="HR_LOW">Low Heart Rate</option>
              <option value="SPO2_LOW">Low SpO2 Saturation</option>
              <option value="TEMP_HIGH">Elevated Temperature</option>
              <option value="TEMP_LOW">Low Temperature</option>
              <option value="TREND_HR">HR Trend Change</option>
              <option value="DEVICE_DISCONNECTED">Device Disconnected</option>
              <option value="INVALID_DATA">Sensor Noise / Off</option>
            </select>

            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>

        {/* Alerts Table / List */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
            Loading telemetry alarms from server...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 text-teal-500 mx-auto opacity-60" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No alarms found</p>
            <p className="text-[11px]">All physiological telemetry signals are within safe thresholds.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-[#E5EAF1] dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Alert Condition</th>
                  {isDoctorOrAdmin && <th className="py-2.5 px-3">Patient</th>}
                  <th className="py-2.5 px-3">Breach Value</th>
                  <th className="py-2.5 px-3">Triggered</th>
                  <th className="py-2.5 px-3">Status</th>
                  {isDoctorOrAdmin && <th className="py-2.5 px-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF1] dark:divide-slate-800/60">
                {filteredAlerts.map((a) => {
                  const isCritical = a.severity === 'critical';
                  const isAck = Boolean(a.acknowledgedAt);
                  const isResolved = Boolean(a.resolvedAt);

                  return (
                    <tr
                      key={a._id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors ${
                        !isAck && !isResolved ? (isCritical ? 'bg-rose-50/30 dark:bg-rose-950/20' : 'bg-amber-50/20 dark:bg-amber-950/10') : ''
                      }`}
                    >
                      {/* Severity Badge */}
                      <td className="py-3 px-3">
                        <Badge
                          variant={isCritical ? 'danger' : (a.severity === 'warning' ? 'warning' : 'info')}
                          size="sm"
                          className="capitalize flex items-center gap-1 w-fit font-bold"
                        >
                          {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />}
                          {a.severity}
                        </Badge>
                      </td>

                      {/* Alert Type / Description */}
                      <td className="py-3 px-3">
                        <p className="font-bold text-[#0B1F3A] dark:text-white">{a.type}</p>
                        {a.plainLanguage && (
                          <p className="text-[11px] text-teal-600 dark:text-teal-400 mt-0.5">{a.plainLanguage}</p>
                        )}
                        {a.note && (
                          <p className="text-[11px] text-slate-500 italic mt-0.5">Note: "{a.note}"</p>
                        )}
                      </td>

                      {/* Patient Info */}
                      {isDoctorOrAdmin && (
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{a.patient?.name || 'N/A'}</p>
                          <p className="text-[10px] font-mono text-slate-400">{a.patient?.patientId || a.patientId}</p>
                        </td>
                      )}

                      {/* Breach Value */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {a.value !== null && a.value !== undefined
                          ? (typeof a.value === 'object' ? JSON.stringify(a.value) : a.value)
                          : 'N/A'}
                      </td>

                      {/* Triggered Time */}
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        <p>{new Date(a.triggeredAt).toLocaleTimeString()}</p>
                        <p className="text-[10px] text-slate-400">{new Date(a.triggeredAt).toLocaleDateString()}</p>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {isResolved ? (
                          <Badge variant="success" size="sm">Resolved</Badge>
                        ) : isAck ? (
                          <Badge variant="neutral" size="sm">Acknowledged</Badge>
                        ) : (
                          <Badge variant="danger" size="sm">Active</Badge>
                        )}
                      </td>

                      {/* Clinician Action */}
                      {isDoctorOrAdmin && (
                        <td className="py-3 px-3 text-right">
                          {!isAck ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAckModalAlert(a);
                                setAckNote('');
                              }}
                              className="text-xs py-1 px-2.5 h-auto text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30"
                            >
                              Acknowledge
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              By {a.acknowledgedBy?.name || 'Doctor'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Clinician Acknowledgment Modal */}
      {ackModalAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0c1626] border border-[#E5EAF1] dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white">
                  Acknowledge Telemetry Alarm
                </h3>
                <p className="text-xs text-slate-400">
                  {ackModalAlert.type} ({ackModalAlert.severity.toUpperCase()})
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs space-y-1.5">
              <p><strong>Patient:</strong> {ackModalAlert.patient?.name || 'N/A'} ({ackModalAlert.patient?.patientId || 'N/A'})</p>
              <p><strong>Breach Reading:</strong> {JSON.stringify(ackModalAlert.value)}</p>
              <p><strong>Session:</strong> <span className="font-mono">{ackModalAlert.sessionId}</span></p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Clinical Intervention Note (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Administered 2L oxygen via nasal cannula. Patient vitals stabilized."
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs rounded-xl p-3 text-[#0B1F3A] dark:text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAckModalAlert(null)}
                disabled={ackSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAcknowledge}
                disabled={ackSubmitting}
              >
                {ackSubmitting ? 'Recording...' : 'Confirm Acknowledgment'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AlertsPage;
