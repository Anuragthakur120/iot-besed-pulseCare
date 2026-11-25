import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Activity,
  Calendar,
  Clock,
  ArrowLeft,
  ChevronRight,
  Filter,
  BarChart2,
  AlertTriangle,
  Scale,
  RefreshCw
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
import api from '@/services/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusPill } from '@/components/StatusPill';

export default function HistoricalChartsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryPatientId = searchParams.get('patientId') || 'PC-DEMO01';
  const querySessionId = searchParams.get('sessionId') || '';

  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState(queryPatientId);
  const [selectedSessionId, setSelectedSessionId] = useState(querySessionId);
  const [sessions, setSessions] = useState([]);
  const [range, setRange] = useState('24h'); // '24h' | '7d' | '30d' | 'all'
  const [readings, setReadings] = useState([]);
  const [summary, setSummary] = useState(null);

  // Comparison State
  const [isComparing, setIsComparing] = useState(false);
  const [compareSessionA, setCompareSessionA] = useState('');
  const [compareSessionB, setCompareSessionB] = useState('');
  const [comparisonResult, setComparisonResult] = useState(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  // 1. Fetch available sessions for patient
  useEffect(() => {
    if (!patientId) return;

    api
      .get(`/api/patients/${patientId}/sessions`)
      .then((res) => {
        const sList = res.data?.data?.sessions || [];
        setSessions(sList);
        if (!selectedSessionId && sList.length > 0) {
          setSelectedSessionId(sList[0].sessionId);
        }
      })
      .catch((err) => console.error('Failed to load patient sessions:', err));
  }, [patientId]);

  // 2. Fetch Readings & Summary for selected parameters
  useEffect(() => {
    if (!patientId) return;

    async function loadReadingsAndSummary() {
      try {
        setLoading(true);
        const query = new URLSearchParams();
        if (selectedSessionId) query.set('sessionId', selectedSessionId);
        if (range !== 'all') query.set('range', range);

        const readingsRes = await api.get(`/api/patients/${patientId}/readings?${query.toString()}`);
        if (readingsRes.data?.data?.readings) {
          const formatted = readingsRes.data.data.readings.map((r) => ({
            ts: new Date(r.ts).toLocaleString(),
            heartRate: r.heartRate,
            spo2: r.spo2,
            temperatureC: r.temperatureC
          }));
          setReadings(formatted);
        }

        if (selectedSessionId) {
          const summaryRes = await api.get(`/api/sessions/${selectedSessionId}/summary`);
          if (summaryRes.data?.data) {
            setSummary(summaryRes.data.data);
          }
        }
      } catch (err) {
        console.error('Failed to load telemetry dataset:', err);
      } finally {
        setLoading(false);
      }
    }

    loadReadingsAndSummary();
  }, [patientId, selectedSessionId, range]);

  // 3. Comparison Handler
  const handleRunComparison = async () => {
    if (!compareSessionA || !compareSessionB) return;
    setLoadingComparison(true);
    try {
      const res = await api.get(`/api/sessions/compare?a=${compareSessionA}&b=${compareSessionB}`);
      if (res.data?.data) {
        setComparisonResult(res.data.data);
      }
    } catch (err) {
      console.error('Failed to run session comparison:', err);
    } finally {
      setLoadingComparison(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#0c1626] p-6 rounded-2xl border border-[#E5EAF1] dark:border-slate-800 shadow-sm">
        <div>
          <button
            onClick={() => navigate(`/doctor/patients/${patientId}`)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-600 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Patient Profile
          </button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            Historical Telemetry & Session Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Patient: <strong className="font-mono">{patientId}</strong> • Downsampled up to 1000 points
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant={isComparing ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setIsComparing((prev) => !prev)}
            className="flex items-center gap-1.5"
          >
            <Scale className="w-4 h-4" />
            <span>{isComparing ? 'Hide Comparison' : 'Compare Sessions'}</span>
          </Button>
        </div>
      </div>

      {/* Comparison Drawer / Panel */}
      {isComparing && (
        <Card className="p-6 space-y-4 border-teal-500/30 bg-teal-500/5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-teal-500" />
              Side-by-Side Session Mathematical Comparison
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              Strictly quantitative delta metrics • No subjective interpretation
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Session Baseline (A)
              </label>
              <select
                value={compareSessionA}
                onChange={(e) => setCompareSessionA(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none"
              >
                <option value="">-- Choose Session A --</option>
                {sessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.sessionId} ({new Date(s.startedAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Session Comparison (B)
              </label>
              <select
                value={compareSessionB}
                onChange={(e) => setCompareSessionB(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none"
              >
                <option value="">-- Choose Session B --</option>
                {sessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.sessionId} ({new Date(s.startedAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleRunComparison}
                isLoading={loadingComparison}
                disabled={!compareSessionA || !compareSessionB}
                className="w-full justify-center"
              >
                Compute Deltas
              </Button>
            </div>
          </div>

          {/* Comparison Results */}
          {comparisonResult && (
            <div className="space-y-4 pt-3 border-t border-teal-500/20">
              {/* Warnings */}
              {comparisonResult.dataQualityWarnings?.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Data Quality Notice:
                  </div>
                  {comparisonResult.dataQualityWarnings.map((w, idx) => (
                    <p key={idx}>• {w}</p>
                  ))}
                </div>
              )}

              {/* Differences Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-sans">
                    Average HR Delta (B - A)
                  </span>
                  <p className="text-xl font-bold text-rose-500 tabular-nums">
                    {comparisonResult.difference.heartRateAvgDelta > 0 ? '+' : ''}
                    {comparisonResult.difference.heartRateAvgDelta ?? '--'} bpm
                  </p>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Session A: {comparisonResult.sessionA.stats.heartRate.avg ?? '--'} | B:{' '}
                    {comparisonResult.sessionB.stats.heartRate.avg ?? '--'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-sans">
                    Average SpO2 Delta (B - A)
                  </span>
                  <p className="text-xl font-bold text-teal-600 dark:text-teal-400 tabular-nums">
                    {comparisonResult.difference.spo2AvgDelta > 0 ? '+' : ''}
                    {comparisonResult.difference.spo2AvgDelta ?? '--'}%
                  </p>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Session A: {comparisonResult.sessionA.stats.spo2.avg ?? '--'}% | B:{' '}
                    {comparisonResult.sessionB.stats.spo2.avg ?? '--'}%
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 font-sans">
                    Average Temp Delta (B - A)
                  </span>
                  <p className="text-xl font-bold text-amber-500 tabular-nums">
                    {comparisonResult.difference.temperatureCAvgDelta > 0 ? '+' : ''}
                    {comparisonResult.difference.temperatureCAvgDelta ?? '--'}°C
                  </p>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Session A: {comparisonResult.sessionA.stats.temperatureC.avg ?? '--'}° | B:{' '}
                    {comparisonResult.sessionB.stats.temperatureC.avg ?? '--'}°
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Session Selector */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Session:</span>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none"
              >
                <option value="">All Sessions</option>
                {sessions.map((s) => (
                  <option key={s.sessionId} value={s.sessionId}>
                    {s.sessionId} ({new Date(s.startedAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Time Window Buttons */}
            <div className="flex items-center p-0.5 rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-[#F6F8FB] dark:bg-slate-900">
              {['24h', '7d', '30d', 'all'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase transition-colors ${
                    range === r
                      ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <span className="text-slate-400 font-mono text-[11px]">
            {readings.length} data points loaded
          </span>
        </div>
      </Card>

      {/* Session Statistical Summary Box */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono">
          <Card className="p-4 space-y-1">
            <span className="text-[10px] uppercase font-sans text-slate-400">Duration & Validity</span>
            <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
              {summary.durationMinutes} min
            </p>
            <p className="text-[10px] text-teal-600 dark:text-teal-400 font-sans">
              {summary.validDataPercent}% valid readings
            </p>
          </Card>

          <Card className="p-4 space-y-1">
            <span className="text-[10px] uppercase font-sans text-slate-400">Heart Rate Stats</span>
            <p className="text-lg font-bold text-rose-500 tabular-nums">
              Avg {summary.stats.heartRate.avg ?? '--'} bpm
            </p>
            <p className="text-[10px] text-slate-400">
              Min: {summary.stats.heartRate.min ?? '--'} | Max: {summary.stats.heartRate.max ?? '--'}
            </p>
          </Card>

          <Card className="p-4 space-y-1">
            <span className="text-[10px] uppercase font-sans text-slate-400">SpO2 Oxygen Stats</span>
            <p className="text-lg font-bold text-teal-600 dark:text-teal-400 tabular-nums">
              Avg {summary.stats.spo2.avg ?? '--'}%
            </p>
            <p className="text-[10px] text-slate-400">
              Min: {summary.stats.spo2.min ?? '--'}% | Max: {summary.stats.spo2.max ?? '--'}%
            </p>
          </Card>

          <Card className="p-4 space-y-1">
            <span className="text-[10px] uppercase font-sans text-slate-400">Core Temp Stats</span>
            <p className="text-lg font-bold text-amber-500 tabular-nums">
              Avg {summary.stats.temperatureC.avg ?? '--'}°C
            </p>
            <p className="text-[10px] text-slate-400">
              Min: {summary.stats.temperatureC.min ?? '--'}° | Max: {summary.stats.temperatureC.max ?? '--'}°
            </p>
          </Card>
        </div>
      )}

      {/* Main Historical Recharts Chart */}
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-teal-500" />
          Continuous Telemetry Profile
        </h3>

        <div className="h-80 w-full">
          {readings.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No telemetry samples recorded for the selected window.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={readings}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="ts" tick={{ fontSize: 10, fill: '#94a3b8' }} minTickGap={40} />
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
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="heartRate"
                  name="Heart Rate (BPM)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="spo2"
                  name="SpO2 (%)"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
