import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  Play,
  FileText,
  Clock,
  AlertTriangle,
  User,
  Phone,
  Mail,
  Calendar,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Lock,
  Eye,
  Plus,
  RefreshCw,
  Camera
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import api from '@/services/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { StatusPill } from '@/components/StatusPill';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';
import { Checkbox } from '@/components/Checkbox';

export default function PatientDetailsPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Photo
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // New Note Modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [visibleToPatient, setVisibleToPatient] = useState(true);
  const [savingNote, setSavingNote] = useState(false);

  // Start Session Modal
  const [isStartSessionModalOpen, setIsStartSessionModalOpen] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [startingSession, setStartingSession] = useState(false);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const [patientRes, sessionsRes, notesRes, devicesRes] = await Promise.all([
        api.get(`/api/patients/${patientId}`),
        api.get(`/api/patients/${patientId}/sessions`),
        api.get(`/api/patients/${patientId}/notes`),
        api.get('/api/devices')
      ]);

      if (patientRes.data?.data?.patient) {
        setPatient(patientRes.data.data.patient);
      }
      if (sessionsRes.data?.data?.sessions) {
        setSessions(sessionsRes.data.data.sessions);
      }
      if (notesRes.data?.data?.notes) {
        setNotes(notesRes.data.data.notes);
      }
      if (devicesRes.data?.data?.devices) {
        setDevices(devicesRes.data.data.devices);
      }

      // Fetch signed photo URL if profileImage exists
      if (patientRes.data?.data?.patient?.profileImage?.storageKey) {
        try {
          const photoRes = await api.get(`/api/patients/${patientId}/photo`);
          if (photoRes.data?.data?.url) {
            setPhotoUrl(photoRes.data.data.url);
          }
        } catch {
          // ignore photo url failure
        }
      }
    } catch (err) {
      addToast({
        title: 'Error loading patient file',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientData();
  }, [patientId]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    setUploadingPhoto(true);
    try {
      await api.post(`/api/patients/${patientId}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      addToast({ title: 'Photo Uploaded', message: 'Profile photo processed and stored securely', type: 'success' });
      fetchPatientData();
    } catch (err) {
      addToast({
        title: 'Photo Upload Failed',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setSavingNote(true);
    try {
      const res = await api.post(`/api/patients/${patientId}/notes`, {
        content: noteContent,
        visibleToPatient
      });

      addToast({ title: 'Clinical Note Saved', message: 'Note recorded in patient timeline', type: 'success' });
      setNotes((prev) => [res.data.data.note, ...prev]);
      setIsNoteModalOpen(false);
      setNoteContent('');
    } catch (err) {
      addToast({
        title: 'Failed to Save Note',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setSavingNote(false);
    }
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!selectedDeviceId) {
      addToast({ title: 'Validation', message: 'Select an available device', type: 'warning' });
      return;
    }

    setStartingSession(true);
    try {
      const response = await api.post('/api/sessions', {
        patientId,
        deviceId: selectedDeviceId,
        notes: sessionNotes
      });

      addToast({
        title: 'Session Started',
        message: `Monitoring session initiated for patient with device ${selectedDeviceId}`,
        type: 'success'
      });

      setIsStartSessionModalOpen(false);
      navigate(`/monitoring/live?sessionId=${response.data.data.session.sessionId}&patientId=${patientId}`);
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

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Loading clinical patient record...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Patient Record Not Found</h2>
        <Button variant="outline" onClick={() => navigate('/doctor/patients')}>
          Return to Patient Directory
        </Button>
      </div>
    );
  }

  const tabItems = [
    { id: 'overview', label: 'Clinical Overview' },
    { id: 'sessions', label: `Visits & Sessions (${sessions.length})` },
    { id: 'notes', label: `Clinical Notes (${notes.length})` },
    { id: 'thresholds', label: 'Threshold Profile' }
  ];

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <button
        onClick={() => navigate('/doctor/patients')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Patient Directory</span>
      </button>

      {/* Patient Master Card Header */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar / Photo with upload trigger */}
            <div className="relative group">
              <Avatar
                src={photoUrl}
                name={patient.name}
                size="lg"
                className="w-16 h-16 sm:w-20 sm:h-20 text-xl font-bold ring-2 ring-teal-500/30"
              />
              <label
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                title="Update photo"
              >
                <Camera className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                />
              </label>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-[#0B1F3A] dark:text-white">
                  {patient.name}
                </h1>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold">
                  {patient.patientId}
                </span>
                <StatusPill status={patient.status === 'active' ? 'LIVE' : 'IDLE'} />
              </div>

              {/* Patient Meta Badges */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-2">
                {patient.dob && (
                  <span className="flex items-center gap-1.5 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    DOB: {new Date(patient.dob).toLocaleDateString()}
                  </span>
                )}
                {patient.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {patient.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {patient.email}
                </span>
              </div>
            </div>
          </div>

          {/* Action CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsNoteModalOpen(true)}
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Add Note</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsStartSessionModalOpen(true)}
              className="flex items-center gap-2 shadow-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Live Monitoring</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <Tabs tabs={tabItems} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab 1: Clinical Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-5 space-y-4 md:col-span-2">
            <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <User className="w-4 h-4 text-teal-500" />
              Demographic & Registration Data
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] font-mono uppercase">Full Name</span>
                <p className="font-semibold text-slate-900 dark:text-white">{patient.name}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] font-mono uppercase">Hospital Patient ID</span>
                <p className="font-mono font-bold text-teal-600 dark:text-teal-400">{patient.patientId}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] font-mono uppercase">Registration Date</span>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {new Date(patient.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] font-mono uppercase">Account Status</span>
                <p className="font-semibold capitalize text-slate-900 dark:text-white">{patient.status}</p>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="pt-3 border-t border-[#E5EAF1] dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Designated Emergency Contact
              </h4>
              {patient.emergencyContact?.name ? (
                <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {patient.emergencyContact.name}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {patient.emergencyContact.phone || '--'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md font-bold">
                    Primary Contact
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No emergency contact recorded on file.</p>
              )}
            </div>
          </Card>

          {/* Quick Monitoring Info */}
          <div className="space-y-4">
            <Card className="p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-500" />
                Monitoring Telemetry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Continuous IoT vital monitoring sessions track Heart Rate, Pulse Oximetry (SpO2), and Core Temperature.
              </p>
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setIsStartSessionModalOpen(true)}
                  className="w-full justify-center"
                >
                  <Play className="w-4 h-4 fill-white mr-1.5" />
                  Launch Session
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Visits & Sessions */}
      {activeTab === 'sessions' && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F8FB] dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-[#E5EAF1] dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Session UUID</th>
                  <th className="py-3 px-3">Device</th>
                  <th className="py-3 px-3">Started</th>
                  <th className="py-3 px-3">Ended</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF1] dark:divide-slate-800">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      No monitoring sessions recorded for this patient yet.
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s._id || s.sessionId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {s.sessionId}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-teal-600 dark:text-teal-400 font-semibold">
                        {s.deviceId}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {new Date(s.startedAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {s.endedAt ? new Date(s.endedAt).toLocaleString() : '--'}
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusPill status={s.status === 'active' ? 'LIVE' : 'COMPLETED'} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() =>
                            navigate(
                              s.status === 'active'
                                ? `/monitoring/live?sessionId=${s.sessionId}&patientId=${patientId}`
                                : `/monitoring/history?sessionId=${s.sessionId}&patientId=${patientId}`
                            )
                          }
                          className="text-teal-600 dark:text-teal-400"
                        >
                          {s.status === 'active' ? 'Live Monitor' : 'View Data'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Clinical Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white">
              Clinical Progress Notes
            </h3>
            <Button size="sm" variant="primary" onClick={() => setIsNoteModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Write Note
            </Button>
          </div>

          <div className="space-y-3">
            {notes.length === 0 ? (
              <Card className="p-8 text-center text-xs text-slate-400">
                No clinical notes recorded yet. Click "Write Note" to document clinical observations.
              </Card>
            ) : (
              notes.map((note) => (
                <Card key={note._id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {note.authorId?.name || 'Attending Physician'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        • {new Date(note.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {note.visibleToPatient ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <Eye className="w-3 h-3" /> Visible to Patient
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                        <Lock className="w-3 h-3" /> Staff Only
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Threshold Profile */}
      {activeTab === 'thresholds' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-teal-500" />
                Telemetry Alert Thresholds
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Baseline physiological ranges for bedside telemetry alarms
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold border border-teal-500/20">
              Standard Adult Profile
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-400">Heart Rate Range</span>
              <p className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                50 - 120 <span className="text-xs font-normal text-slate-400">bpm</span>
              </p>
              <p className="text-[10px] text-slate-400">Triggers HR_LOW below 50, HR_HIGH above 120</p>
            </div>

            <div className="p-4 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-400">Pulse Oximetry Min</span>
              <p className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                92% <span className="text-xs font-normal text-slate-400">SpO2</span>
              </p>
              <p className="text-[10px] text-slate-400">Triggers SPO2_LOW below 92% (Critical below 90%)</p>
            </div>

            <div className="p-4 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-400">Core Temp Range</span>
              <p className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                35.5 - 38.0 <span className="text-xs font-normal text-slate-400">°C</span>
              </p>
              <p className="text-[10px] text-slate-400">Triggers TEMP_LOW below 35.5, TEMP_HIGH above 38.0</p>
            </div>
          </div>
        </Card>
      )}

      {/* Note Composer Modal */}
      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title="Document Clinical Progress Note"
        size="md"
      >
        <form onSubmit={handleCreateNote} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Note Content
            </label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              required
              rows={4}
              placeholder="Record findings, examination notes, medication adjustments..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="visibleToPatient"
              checked={visibleToPatient}
              onChange={(e) => setVisibleToPatient(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <label htmlFor="visibleToPatient" className="text-xs text-slate-700 dark:text-slate-300">
              Visible to patient on their portal dashboard
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5EAF1] dark:border-slate-800">
            <Button variant="ghost" type="button" onClick={() => setIsNoteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={savingNote}>
              Save Note
            </Button>
          </div>
        </form>
      </Modal>

      {/* Start Session Modal */}
      <Modal
        isOpen={isStartSessionModalOpen}
        onClose={() => setIsStartSessionModalOpen(false)}
        title="Pair Device & Start Live Session"
        size="md"
      >
        <form onSubmit={handleStartSession} className="space-y-4 pt-2">
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
              Session Purpose / Clinical Reason (Optional)
            </label>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="e.g. 24-hour continuous post-surgical telemetry..."
              rows={3}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5EAF1] dark:border-slate-800">
            <Button variant="ghost" type="button" onClick={() => setIsStartSessionModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={startingSession}>
              Connect & Start Stream
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
