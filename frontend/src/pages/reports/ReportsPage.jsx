import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Eye,
  Calendar,
  Clock,
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Search,
  Filter,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';

export function ReportsPage() {
  const { user } = useAuth();
  const isDoctorOrAdmin = user?.role === 'doctor' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [previewSession, setPreviewSession] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [researchExporting, setResearchExporting] = useState(false);

  useEffect(() => {
    async function fetchSessions() {
      try {
        setLoading(true);
        // For patient: fetch their own sessions; for doctor/admin: fetch recent sessions
        const endpoint = user?.role === 'patient' && user?.patientId
          ? `/patients/${user.patientId}/sessions`
          : '/dashboard/doctor-summary';

        const res = await api.get(endpoint);
        if (res.data?.success) {
          if (user?.role === 'patient') {
            setSessions(res.data.data.sessions || []);
          } else {
            // Fetch sessions list via patient endpoint or dashboard
            const patientsRes = await api.get('/patients?limit=20');
            if (patientsRes.data?.success) {
              const allSessions = [];
              for (const p of (patientsRes.data.data.patients || []).slice(0, 8)) {
                try {
                  const sRes = await api.get(`/patients/${p.patientId}/sessions`);
                  if (sRes.data?.success && sRes.data.data.sessions) {
                    allSessions.push(...sRes.data.data.sessions.map((s) => ({ ...s, patient: p })));
                  }
                } catch (e) {
                  // ignore individual patient errors
                }
              }
              setSessions(allSessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)));
            }
          }
        }
      } catch (err) {
        console.error('[ReportsPage] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, [user]);

  // Download PDF
  const handleDownloadPdf = async (sessionId) => {
    try {
      setDownloadingId(sessionId);
      setDownloadingFormat('pdf');
      const response = await api.get(`/api/sessions/${sessionId}/report.pdf`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PulseCare-Report-${sessionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ReportsPage] PDF download error:', err);
      alert('Failed to generate PDF report. Please verify session data exists.');
    } finally {
      setDownloadingId(null);
      setDownloadingFormat(null);
    }
  };

  // Download CSV
  const handleDownloadCsv = async (sessionId) => {
    try {
      setDownloadingId(sessionId);
      setDownloadingFormat('csv');
      const response = await api.get(`/api/sessions/${sessionId}/readings.csv`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PulseCare-Readings-${sessionId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ReportsPage] CSV download error:', err);
      alert('Failed to export CSV telemetry.');
    } finally {
      setDownloadingId(null);
      setDownloadingFormat(null);
    }
  };

  // Research CSV Export (Admin only)
  const handleResearchExport = async () => {
    try {
      setResearchExporting(true);
      const response = await api.get('/reports/research-export.csv', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PulseCare-Anonymized-Research-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ReportsPage] Research export error:', err);
      alert('Failed to export research dataset.');
    } finally {
      setResearchExporting(false);
    }
  };

  // Quick Preview
  const handleOpenPreview = async (s) => {
    setPreviewSession(s);
    setPreviewLoading(true);
    try {
      const res = await api.get(`/sessions/${s.sessionId}/summary`);
      if (res.data?.success) {
        setPreviewData(res.data.data);
      }
    } catch (err) {
      console.error('[ReportsPage] Preview error:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const sid = s.sessionId.toLowerCase();
    const did = s.deviceId?.toLowerCase() || '';
    const pname = s.patient?.name?.toLowerCase() || '';
    return sid.includes(q) || did.includes(q) || pname.includes(q);
  });

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            Clinical Reports & Telemetry Datasets
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Download hospital-grade PDF summaries with vector trends, export high-frequency CSV logs, and access audit-logged telemetry archives.
          </p>
        </div>

        {/* Admin Anonymized Research Export */}
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResearchExport}
            disabled={researchExporting}
            className="flex items-center gap-2 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
          >
            <Database className={`w-3.5 h-3.5 ${researchExporting ? 'animate-spin' : ''}`} />
            <span>{researchExporting ? 'Exporting Research Dataset...' : 'Anonymized Research CSV'}</span>
          </Button>
        )}
      </div>

      {/* Sessions Table Card */}
      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5EAF1] dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#0B1F3A] dark:text-white">Telemetry Monitoring Sessions</h2>
            <Badge variant="neutral" size="sm">{filteredSessions.length}</Badge>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search session or device..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
            Loading session telemetry archives...
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-2">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No monitoring sessions found</p>
            <p className="text-[11px]">Sessions recorded by hardware nodes will appear here for report export.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-[#E5EAF1] dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Session ID</th>
                  {isDoctorOrAdmin && <th className="py-2.5 px-3">Patient</th>}
                  <th className="py-2.5 px-3">Device Node</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Started At</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3 text-right">Download & Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF1] dark:divide-slate-800/60">
                {filteredSessions.map((s) => {
                  const isCurrentDownloadingPdf = downloadingId === s.sessionId && downloadingFormat === 'pdf';
                  const isCurrentDownloadingCsv = downloadingId === s.sessionId && downloadingFormat === 'csv';

                  let durationStr = 'In Progress';
                  if (s.startedAt && s.endedAt) {
                    const durSec = Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 1000);
                    const hrs = Math.floor(durSec / 3600);
                    const mins = Math.floor((durSec % 3600) / 60);
                    durationStr = `${hrs}h ${mins}m`;
                  }

                  return (
                    <tr key={s.sessionId} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                      {/* Session ID */}
                      <td className="py-3 px-3 font-mono font-bold text-teal-600 dark:text-teal-400">
                        {s.sessionId}
                      </td>

                      {/* Patient Info */}
                      {isDoctorOrAdmin && (
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{s.patient?.name || 'Assigned Patient'}</p>
                          <p className="text-[10px] font-mono text-slate-400">{s.patient?.patientId || ''}</p>
                        </td>
                      )}

                      {/* Device */}
                      <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                        {s.deviceId}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <Badge
                          variant={s.status === 'active' ? 'success' : (s.status === 'completed' ? 'neutral' : 'warning')}
                          size="sm"
                          className="capitalize"
                        >
                          {s.status}
                        </Badge>
                      </td>

                      {/* Started At */}
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        <p>{new Date(s.startedAt).toLocaleTimeString()}</p>
                        <p className="text-[10px] text-slate-400">{new Date(s.startedAt).toLocaleDateString()}</p>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono">
                        {durationStr}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenPreview(s)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                            title="Quick Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPdf(s.sessionId)}
                            disabled={isCurrentDownloadingPdf}
                            className="text-[11px] py-1 px-2 h-auto text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30 flex items-center gap-1"
                          >
                            <Download className={`w-3 h-3 ${isCurrentDownloadingPdf ? 'animate-bounce' : ''}`} />
                            <span>{isCurrentDownloadingPdf ? 'Generating...' : 'PDF'}</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadCsv(s.sessionId)}
                            disabled={isCurrentDownloadingCsv}
                            className="text-[11px] py-1 px-2 h-auto text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center gap-1"
                          >
                            <Download className={`w-3 h-3 ${isCurrentDownloadingCsv ? 'animate-bounce' : ''}`} />
                            <span>{isCurrentDownloadingCsv ? 'Exporting...' : 'CSV'}</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Preview Modal */}
      {previewSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0c1626] border border-[#E5EAF1] dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E5EAF1] dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white">
                  Session Telemetry Summary
                </h3>
              </div>
              <Badge variant="neutral" size="sm" className="font-mono">{previewSession.sessionId}</Badge>
            </div>

            {previewLoading ? (
              <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                Computing telemetry statistical summary...
              </div>
            ) : previewData ? (
              <div className="space-y-4 text-xs">
                {/* Session Meta */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800">
                  <p><strong>Device Node:</strong> <span className="font-mono">{previewSession.deviceId}</span></p>
                  <p><strong>Status:</strong> <span className="capitalize">{previewSession.status}</span></p>
                  <p><strong>Started:</strong> {new Date(previewSession.startedAt).toLocaleString()}</p>
                  <p><strong>Duration:</strong> {previewData.duration || 'N/A'}</p>
                </div>

                {/* Vitals Summary Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/30 dark:bg-rose-950/10">
                    <p className="font-bold text-rose-600">Heart Rate</p>
                    <p className="text-[11px] text-slate-500 mt-1">Avg: <span className="font-mono font-bold text-slate-800 dark:text-white">{previewData.metrics?.hr?.avg ?? 'N/A'}</span></p>
                    <p className="text-[10px] text-slate-400">Min: {previewData.metrics?.hr?.min ?? 'N/A'} | Max: {previewData.metrics?.hr?.max ?? 'N/A'}</p>
                  </div>

                  <div className="p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-950/10">
                    <p className="font-bold text-blue-600">SpO2 Saturation</p>
                    <p className="text-[11px] text-slate-500 mt-1">Avg: <span className="font-mono font-bold text-slate-800 dark:text-white">{previewData.metrics?.spo2?.avg ? `${previewData.metrics.spo2.avg}%` : 'N/A'}</span></p>
                    <p className="text-[10px] text-slate-400">Min: {previewData.metrics?.spo2?.min ?? 'N/A'}%</p>
                  </div>

                  <div className="p-3 rounded-xl border border-teal-100 dark:border-teal-900/30 bg-teal-50/30 dark:bg-teal-950/10">
                    <p className="font-bold text-teal-600">Temperature</p>
                    <p className="text-[11px] text-slate-500 mt-1">Avg: <span className="font-mono font-bold text-slate-800 dark:text-white">{previewData.metrics?.temp?.avg ? `${previewData.metrics.temp.avg}°C` : 'N/A'}</span></p>
                    <p className="text-[10px] text-slate-400">Max: {previewData.metrics?.temp?.max ?? 'N/A'}°C</p>
                  </div>
                </div>

                {/* Alerts count */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Total Clinical Alarms Detected:</span>
                  <Badge variant={previewData.alertCount > 0 ? 'warning' : 'success'} size="sm">
                    {previewData.alertCount || 0} Alarms
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-center text-xs text-slate-400 py-6">Summary data currently unavailable for this session.</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5EAF1] dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setPreviewSession(null)}>
                Close Preview
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  handleDownloadPdf(previewSession.sessionId);
                  setPreviewSession(null);
                }}
              >
                Download Full PDF Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;
