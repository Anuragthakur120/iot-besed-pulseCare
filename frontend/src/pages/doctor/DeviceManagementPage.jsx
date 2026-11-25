import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu,
  Plus,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Radio,
  Play,
  RotateCw,
  Slash,
  Wifi,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Activity
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { useSocket } from '@/hooks/useSocket';
import api from '@/services/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusPill } from '@/components/StatusPill';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function DeviceManagementPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [patients, setPatients] = useState([]);

  // Create Device Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newDeviceLabel, setNewDeviceLabel] = useState('');
  const [newCustomDeviceId, setNewCustomDeviceId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdDeviceResult, setCreatedDeviceResult] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Revoke Dialog State
  const [deviceToRevoke, setDeviceToRevoke] = useState(null);
  const [revoking, setRevoking] = useState(false);

  // Rotate Key Dialog State
  const [deviceToRotate, setDeviceToRotate] = useState(null);
  const [rotating, setRotating] = useState(false);

  // Pair / Assign Session Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [startingSession, setStartingSession] = useState(false);

  // Socket for real-time heartbeat updates
  const { deviceStatuses } = useSocket({ subscribeOps: true });

  const fetchDevicesAndPatients = async () => {
    try {
      setLoading(true);
      const [devRes, patRes] = await Promise.all([
        api.get('/api/devices'),
        api.get('/api/patients?limit=50').catch(() => ({ data: { data: { patients: [] } } }))
      ]);

      if (devRes.data?.data?.devices) {
        setDevices(devRes.data.data.devices);
      }
      if (patRes.data?.data?.patients) {
        setPatients(patRes.data.data.patients);
      }
    } catch (err) {
      addToast({
        title: 'Error loading devices',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevicesAndPatients();
  }, []);

  // Sync real-time device updates from Socket.IO
  useEffect(() => {
    if (Object.keys(deviceStatuses).length === 0) return;

    setDevices((prevDevices) =>
      prevDevices.map((d) => {
        const update = deviceStatuses[d.deviceId];
        if (update) {
          return {
            ...d,
            status: d.status === 'revoked' ? 'revoked' : (update.status === 'LIVE' ? 'active' : d.status),
            lastHeartbeatAt: update.lastActivityAt || d.lastHeartbeatAt,
            currentSessionId: update.currentSessionId !== undefined ? update.currentSessionId : d.currentSessionId
          };
        }
        return d;
      })
    );
  }, [deviceStatuses]);

  // Handle Create Device
  const handleCreateDevice = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        label: newDeviceLabel || undefined,
        deviceId: newCustomDeviceId || undefined
      };

      const res = await api.post('/api/devices', payload);
      setCreatedDeviceResult(res.data.data);
      addToast({
        title: 'Device Registered',
        message: `Generated pairing code for ${res.data.data.deviceId}`,
        type: 'success'
      });

      fetchDevicesAndPatients();
    } catch (err) {
      addToast({
        title: 'Registration Failed',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setCreating(false);
    }
  };

  // Copy Pairing Code Helper
  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    addToast({ title: 'Copied', message: 'Pairing code copied to clipboard', type: 'info' });
  };

  // Handle Revoke Device
  const handleRevokeConfirm = async () => {
    if (!deviceToRevoke) return;
    setRevoking(true);
    try {
      await api.post(`/api/devices/${deviceToRevoke.deviceId}/revoke`);
      addToast({
        title: 'Device Revoked',
        message: `Device ${deviceToRevoke.deviceId} authorization has been blocked immediately`,
        type: 'warning'
      });
      setDeviceToRevoke(null);
      fetchDevicesAndPatients();
    } catch (err) {
      addToast({
        title: 'Failed to Revoke',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setRevoking(false);
    }
  };

  // Handle Rotate Key
  const handleRotateKey = async () => {
    if (!deviceToRotate) return;
    setRotating(true);
    try {
      const res = await api.post(`/api/devices/${deviceToRotate.deviceId}/rotate-key`);
      setCreatedDeviceResult(res.data.data);
      setDeviceToRotate(null);
      setIsCreateModalOpen(true); // Open dialog to show new pairing code
      addToast({
        title: 'Key Rotated',
        message: `New pairing code generated for ${deviceToRotate.deviceId}`,
        type: 'success'
      });
      fetchDevicesAndPatients();
    } catch (err) {
      addToast({
        title: 'Rotation Failed',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setRotating(false);
    }
  };

  // Handle Assign Device to Session
  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!selectedDevice || !selectedPatientId) return;

    setStartingSession(true);
    try {
      const res = await api.post('/api/sessions', {
        deviceId: selectedDevice.deviceId,
        patientId: selectedPatientId,
        notes: sessionNotes
      });

      addToast({
        title: 'Session Started',
        message: `Monitoring session started with device ${selectedDevice.deviceId}`,
        type: 'success'
      });

      setIsAssignModalOpen(false);
      navigate(`/monitoring/live?sessionId=${res.data.data.session.sessionId}&patientId=${selectedPatientId}`);
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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#0c1626] p-6 rounded-2xl border border-[#E5EAF1] dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            Hardware Bedside Devices & Nodes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            ESP32 Microcontroller Nodes • Cryptographic Authentication & Telemetry Routing
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchDevicesAndPatients} isLoading={loading}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCreatedDeviceResult(null);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Device</span>
          </Button>
        </div>
      </div>

      {/* Device List Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F8FB] dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-[#E5EAF1] dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Device Code</th>
                <th className="py-3 px-3">Location / Label</th>
                <th className="py-3 px-3">Security Status</th>
                <th className="py-3 px-3">Firmware</th>
                <th className="py-3 px-3">Last Heartbeat</th>
                <th className="py-3 px-3">Active Session</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF1] dark:divide-slate-800">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    No hardware devices registered yet. Click "Register New Device" to pair an ESP32 node.
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  const isRevoked = device.status === 'revoked';
                  const isPending = device.status === 'pending';
                  const hasSession = Boolean(device.currentSessionId);

                  return (
                    <tr
                      key={device.deviceId}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono text-xs font-bold ${
                              isRevoked
                                ? 'bg-rose-500/10 text-rose-500'
                                : isPending
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                            }`}
                          >
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-mono font-bold text-slate-900 dark:text-white block">
                              {device.deviceId}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {device.ipLast ? `IP: ${device.ipLast}` : 'LAN node'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-semibold text-slate-700 dark:text-slate-200">
                        {device.label || 'Bedside Node'}
                      </td>

                      <td className="py-3.5 px-3">
                        {isRevoked ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            Revoked
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Pending Pairing
                          </span>
                        ) : (
                          <StatusPill status={hasSession ? 'LIVE' : 'IDLE'} />
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-500">
                        v{device.firmwareVersion || '1.0.0'}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {device.lastHeartbeatAt ? (
                          new Date(device.lastHeartbeatAt).toLocaleTimeString()
                        ) : (
                          <span className="text-slate-400">Never</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        {hasSession ? (
                          <button
                            onClick={() => navigate(`/monitoring/live?sessionId=${device.currentSessionId}`)}
                            className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                          >
                            <Activity className="w-3.5 h-3.5 animate-pulse" />
                            {device.currentSessionId.slice(0, 8)}...
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isRevoked && !hasSession && device.status === 'active' && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => {
                                setSelectedDevice(device);
                                setIsAssignModalOpen(true);
                              }}
                              className="text-teal-600 dark:text-teal-400 hover:border-teal-500"
                            >
                              Assign
                            </Button>
                          )}

                          {!isRevoked && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => setDeviceToRotate(device)}
                              title="Rotate Pairing Secret Key"
                            >
                              <RotateCw className="w-3.5 h-3.5 text-slate-400 hover:text-teal-500" />
                            </Button>
                          )}

                          {!isRevoked ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => setDeviceToRevoke(device)}
                              title="Revoke and Block Device"
                              className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Slash className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <span className="text-[10px] text-rose-400 font-mono italic">Blocked</span>
                          )}
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

      {/* Register Device Modal / Pairing Code Display */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={createdDeviceResult ? 'Device Pairing Code Generated' : 'Register New IoT Bedside Node'}
        size="md"
      >
        {createdDeviceResult ? (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-800 dark:text-teal-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Hardware Authentication Key Ready
              </div>
              <p>
                Enter this 6-digit pairing code into the ESP32 serial monitor or captive portal. The node will exchange this code for an HMAC-SHA256 device key.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                Target Device ID: <strong className="text-white">{createdDeviceResult.deviceId}</strong>
              </span>

              <div className="flex items-center justify-center gap-3 py-2">
                <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-teal-400 tabular-nums">
                  {createdDeviceResult.pairingCode}
                </span>
                <button
                  onClick={() => handleCopyCode(createdDeviceResult.pairingCode)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Copy Pairing Code"
                >
                  {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              <span className="text-[11px] text-amber-400 font-mono block">
                Expires in 15 minutes • Will NEVER be displayed again
              </span>
            </div>

            <div className="pt-2 text-right">
              <Button variant="primary" onClick={() => setIsCreateModalOpen(false)}>
                Done & Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateDevice} className="space-y-4 pt-2">
            <Input
              label="Ward / Room Bedside Label"
              value={newDeviceLabel}
              onChange={(e) => setNewDeviceLabel(e.target.value)}
              placeholder="e.g. ICU Room 3 - Bedside Hub"
              required
            />

            <Input
              label="Custom Device ID (Optional - Leave blank to auto-generate PCD-XXXX)"
              value={newCustomDeviceId}
              onChange={(e) => setNewCustomDeviceId(e.target.value)}
              placeholder="e.g. PCD-0003"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5EAF1] dark:border-slate-800">
              <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={creating}>
                Generate Pairing Code
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Revoke Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deviceToRevoke)}
        onClose={() => setDeviceToRevoke(null)}
        onConfirm={handleRevokeConfirm}
        title={`Revoke Device Authorization: ${deviceToRevoke?.deviceId}`}
        message="Are you sure you want to revoke this hardware node? Any incoming readings and heartbeats will be rejected with HTTP 403 instantly, and active monitoring sessions will be terminated."
        confirmText="Revoke & Block Node"
        confirmVariant="danger"
        isLoading={revoking}
      />

      {/* Rotate Key Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deviceToRotate)}
        onClose={() => setDeviceToRotate(null)}
        onConfirm={handleRotateKey}
        title={`Rotate Cryptographic Key: ${deviceToRotate?.deviceId}`}
        message="This will invalidate the current deviceKey on the hardware node. A new 15-minute pairing code will be generated for re-pairing."
        confirmText="Generate New Pairing Code"
        confirmVariant="primary"
        isLoading={rotating}
      />

      {/* Assign to Patient Session Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Pair Device ${selectedDevice?.deviceId} with Patient`}
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
              Clinical Session Notes (Optional)
            </label>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="e.g. Telemetry pairing initiated from device inventory."
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5EAF1] dark:border-slate-800">
            <Button variant="ghost" type="button" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={startingSession}>
              Start Session
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
