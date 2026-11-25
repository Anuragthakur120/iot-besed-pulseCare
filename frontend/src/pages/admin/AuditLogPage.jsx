import React, { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  User,
  Activity,
  RefreshCw,
  FileText,
  AlertCircle,
  Eye
} from 'lucide-react';
import { api } from '@/services/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';

export function AuditLogPage() {
  const [events, setEvents] = useState([]);
  const [actionsList, setActionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, pages: 1 });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exportingCsv, setExportingCsv] = useState(false);

  // Metadata Detail Modal
  const [selectedMetaEvent, setSelectedMetaEvent] = useState(null);

  const fetchAuditLogs = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', '25');

      if (selectedAction) params.append('action', selectedAction);
      if (selectedTarget) params.append('target', selectedTarget);
      if (search) params.append('actor', search);
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);

      const res = await api.get(`/audit?${params.toString()}`);
      if (res.data?.success) {
        setEvents(res.data.data.events || []);
        setPagination(res.data.data.pagination || { total: 0, page: 1, limit: 25, pages: 1 });
        if (res.data.data.actionsList) {
          setActionsList(res.data.data.actionsList);
        }
      }
    } catch (err) {
      console.error('[AuditLogPage] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs(1);
  }, [selectedAction, selectedTarget, fromDate, toDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAuditLogs(1);
  };

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const params = new URLSearchParams();
      params.append('format', 'csv');
      if (selectedAction) params.append('action', selectedAction);
      if (selectedTarget) params.append('target', selectedTarget);
      if (search) params.append('actor', search);

      const res = await api.get(`/audit?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pulsecare-audit-trail-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[AuditLogPage] CSV export error:', err);
      alert('Failed to export audit log CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  const getActionBadgeVariant = (action) => {
    if (action.includes('FAIL') || action.includes('REVOKE')) return 'danger';
    if (action.includes('LOGIN') || action.includes('START')) return 'success';
    if (action.includes('DOWNLOAD') || action.includes('EXPORT')) return 'info';
    if (action.includes('CHANGE') || action.includes('UPDATE')) return 'warning';
    return 'neutral';
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-white flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Hospital Regulatory Audit Trail & Governance Log
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Immutable system activity logging: authentication, patient charts access, report exports, hardware modifications, and alarms.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="flex items-center gap-2 text-xs"
          >
            <Download className={`w-3.5 h-3.5 ${exportingCsv ? 'animate-bounce' : ''}`} />
            <span>{exportingCsv ? 'Exporting...' : 'Export Audit CSV'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAuditLogs(pagination.page)}
            className="flex items-center gap-2 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Actor */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search actor or patient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Action Filter */}
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">All Action Types</option>
            {actionsList.map((act) => (
              <option key={act} value={act}>{act}</option>
            ))}
            <option value="AUTH_LOGIN">AUTH_LOGIN</option>
            <option value="AUTH_LOGOUT">AUTH_LOGOUT</option>
            <option value="REPORT_DOWNLOAD">REPORT_DOWNLOAD</option>
            <option value="RECORD_VIEW">RECORD_VIEW</option>
            <option value="ALERT_ACKNOWLEDGE">ALERT_ACKNOWLEDGE</option>
            <option value="THRESHOLD_CHANGE">THRESHOLD_CHANGE</option>
            <option value="DEVICE_PAIR">DEVICE_PAIR</option>
            <option value="SESSION_START">SESSION_START</option>
          </select>

          {/* Target Type Filter */}
          <select
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">All Target Types</option>
            <option value="MonitoringSession">MonitoringSession</option>
            <option value="User">User</option>
            <option value="Device">Device</option>
            <option value="Alert">Alert</option>
            <option value="ThresholdProfile">ThresholdProfile</option>
            <option value="PatientChart">PatientChart</option>
          </select>

          {/* From Date */}
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none"
          />

          {/* Search Button */}
          <Button type="submit" size="sm" variant="primary" className="text-xs">
            Apply Filters
          </Button>
        </form>

        {/* Audit Log Table */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
            Loading secure audit events...
          </div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-2">
            <Shield className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No audit events match your criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-[#E5EAF1] dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Timestamp (IST / UTC)</th>
                  <th className="py-2.5 px-3">Action Event</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">Client IP</th>
                  <th className="py-2.5 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF1] dark:divide-slate-800/60 font-sans">
                {events.map((ev) => {
                  const istStr = ev.at ? new Date(ev.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
                  const dateStr = ev.at ? new Date(ev.at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';

                  return (
                    <tr key={ev._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <p className="font-mono text-slate-800 dark:text-slate-200">{istStr} IST</p>
                        <p className="text-[10px] text-slate-400">{dateStr}</p>
                      </td>

                      {/* Action Event Badge */}
                      <td className="py-3 px-3">
                        <Badge variant={getActionBadgeVariant(ev.action)} size="sm" className="font-mono font-bold">
                          {ev.action}
                        </Badge>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {ev.actorId?.name || (ev.actorRole === 'device' ? 'Hardware Node' : 'System')}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-teal-600 dark:text-teal-400 uppercase">
                            {ev.actorRole}
                          </span>
                          {ev.actorId?.email && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                              • {ev.actorId.email}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Target */}
                      <td className="py-3 px-3">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{ev.targetType}</p>
                        {ev.targetId && (
                          <p className="text-[10px] font-mono text-slate-400 truncate max-w-[150px]">
                            {ev.targetId}
                          </p>
                        )}
                      </td>

                      {/* IP */}
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                        {ev.ip || '127.0.0.1'}
                      </td>

                      {/* Details Button */}
                      <td className="py-3 px-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedMetaEvent(ev)}
                          className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                          title="View Context Metadata"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E5EAF1] dark:border-slate-800 pt-3 text-xs">
            <span className="text-slate-400">
              Page {pagination.page} of {pagination.pages} ({pagination.total} events logged)
            </span>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => fetchAuditLogs(pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchAuditLogs(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Metadata Context Modal */}
      {selectedMetaEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0c1626] border border-[#E5EAF1] dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E5EAF1] dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-500" />
                  Audit Event Metadata
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedMetaEvent.action}</p>
              </div>
              <Badge variant={getActionBadgeVariant(selectedMetaEvent.action)} size="sm">
                {selectedMetaEvent.actorRole}
              </Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800">
                <p><strong>Actor:</strong> {selectedMetaEvent.actorId?.name || selectedMetaEvent.actorRole}</p>
                <p><strong>Client IP:</strong> <span className="font-mono">{selectedMetaEvent.ip || '127.0.0.1'}</span></p>
                <p><strong>Target:</strong> {selectedMetaEvent.targetType} ({selectedMetaEvent.targetId || 'N/A'})</p>
                <p><strong>Timestamp:</strong> {new Date(selectedMetaEvent.at).toLocaleString()}</p>
              </div>

              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">Sanitized Request Metadata:</p>
                <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                  {JSON.stringify(selectedMetaEvent.meta || {}, null, 2)}
                </pre>
              </div>

              {selectedMetaEvent.userAgent && (
                <p className="text-[10px] text-slate-400 truncate">
                  User Agent: {selectedMetaEvent.userAgent}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E5EAF1] dark:border-slate-800">
              <Button variant="primary" size="sm" onClick={() => setSelectedMetaEvent(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogPage;
