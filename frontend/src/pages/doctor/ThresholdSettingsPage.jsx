import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldCheck,
  AlertCircle,
  Save,
  Users,
  Clock,
  Heart,
  Thermometer,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { api } from '@/services/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';

export function ThresholdSettingsPage() {
  const [scope, setScope] = useState('default'); // 'default' | 'patient'
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: 'Standard Adult ICU Profile',
    hrMin: 50,
    hrMax: 120,
    spo2Min: 92,
    tempMin: 35.5,
    tempMax: 38.0,
    persistenceSeconds: 5,
    trendWindow: 15,
    trendPercent: 20
  });

  // Fetch initial profiles & patient list
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [threshRes, patientsRes] = await Promise.all([
          api.get('/thresholds'),
          api.get('/patients?limit=50')
        ]);

        if (threshRes.data?.success) {
          const def = threshRes.data.data.defaultProfile;
          if (def) {
            setFormData({
              name: def.name || 'Standard Adult ICU Profile',
              hrMin: def.hrMin ?? 50,
              hrMax: def.hrMax ?? 120,
              spo2Min: def.spo2Min ?? 92,
              tempMin: def.tempMin ?? 35.5,
              tempMax: def.tempMax ?? 38.0,
              persistenceSeconds: def.persistenceSeconds ?? 5,
              trendWindow: def.trendRule?.windowMinutes ?? 15,
              trendPercent: def.trendRule?.percentChange ?? 20
            });
          }
        }

        if (patientsRes.data?.success) {
          setPatients(patientsRes.data.data.patients || []);
        }
      } catch (err) {
        console.error('[ThresholdSettings] Load error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // When patient is selected in 'patient' scope, fetch custom profile if available
  useEffect(() => {
    if (scope === 'patient' && selectedPatientId) {
      api.get(`/thresholds?patientId=${selectedPatientId}`).then((res) => {
        if (res.data?.success && res.data.data.profile) {
          const p = res.data.data.profile;
          setFormData({
            name: p.name || 'Custom Patient Profile',
            hrMin: p.hrMin ?? 50,
            hrMax: p.hrMax ?? 120,
            spo2Min: p.spo2Min ?? 92,
            tempMin: p.tempMin ?? 35.5,
            tempMax: p.tempMax ?? 38.0,
            persistenceSeconds: p.persistenceSeconds ?? 5,
            trendWindow: p.trendRule?.windowMinutes ?? 15,
            trendPercent: p.trendRule?.percentChange ?? 20
          });
        }
      });
    }
  }, [scope, selectedPatientId]);

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setFeedback(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFeedback(null);

    // Validation
    const hrMin = Number(formData.hrMin);
    const hrMax = Number(formData.hrMax);
    const tempMin = Number(formData.tempMin);
    const tempMax = Number(formData.tempMax);
    const spo2Min = Number(formData.spo2Min);
    const persistence = Number(formData.persistenceSeconds);

    if (hrMin >= hrMax) {
      setFeedback({ type: 'error', message: `Heart rate minimum (${hrMin}) must be strictly less than maximum (${hrMax})` });
      return;
    }

    if (tempMin >= tempMax) {
      setFeedback({ type: 'error', message: `Temperature minimum (${tempMin}) must be strictly less than maximum (${tempMax})` });
      return;
    }

    if (spo2Min < 50 || spo2Min > 100) {
      setFeedback({ type: 'error', message: 'SpO2 minimum must be between 50% and 100%' });
      return;
    }

    if (persistence < 0) {
      setFeedback({ type: 'error', message: 'Persistence debounce cannot be negative' });
      return;
    }

    if (scope === 'patient' && !selectedPatientId) {
      setFeedback({ type: 'error', message: 'Please select a patient to apply individual threshold overrides.' });
      return;
    }

    try {
      setSaving(true);
      const res = await api.put('/thresholds', {
        scope,
        patientId: scope === 'patient' ? selectedPatientId : undefined,
        name: formData.name,
        hrMin,
        hrMax,
        spo2Min,
        tempMin,
        tempMax,
        persistenceSeconds: persistence,
        trendRule: {
          windowMinutes: Number(formData.trendWindow) || 15,
          percentChange: Number(formData.trendPercent) || 20
        }
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: scope === 'patient'
            ? 'Custom patient physiological thresholds successfully updated & saved to clinical audit.'
            : 'Standard Ward baseline thresholds updated. New monitoring sessions will snapshot these values.'
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to update threshold profile'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-white flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          Clinical Alarm Threshold Configuration
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure physiological boundaries, persistence debounce windows, and early trajectory trend detection rules.
        </p>
      </div>

      {/* Scope Selector Card */}
      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5EAF1] dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-sm font-bold text-[#0B1F3A] dark:text-white">Profile Scope Selection</h2>
            <p className="text-xs text-slate-400">Choose whether to edit the general ward baseline or an individual patient override.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScope('default')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                scope === 'default'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Ward Default Profile
            </button>
            <button
              type="button"
              onClick={() => setScope('patient')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                scope === 'patient'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Patient Override
            </button>
          </div>
        </div>

        {scope === 'patient' && (
          <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-500/20 space-y-2 animate-in fade-in">
            <label className="text-xs font-semibold text-teal-900 dark:text-teal-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              Select Target Patient
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs rounded-xl p-2.5 text-[#0B1F3A] dark:text-white focus:outline-none focus:border-teal-500"
            >
              <option value="">-- Choose patient from directory --</option>
              {patients.map((p) => (
                <option key={p._id} value={p.patientId || p._id}>
                  {p.name} ({p.patientId || 'ID Pending'}) - {p.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2.5 ${
              feedback.type === 'error'
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                : 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
            }`}
          >
            {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Main Threshold Configuration Form */}
        <form onSubmit={handleSave} className="space-y-6 pt-2">
          {/* Profile Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Profile Designation</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs rounded-xl p-2.5 text-[#0B1F3A] dark:text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Grid of Vital Limits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Heart Rate Limits */}
            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-[#E5EAF1] dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
                <Heart className="w-4 h-4" />
                <span>Heart Rate (BPM)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-semibold">Min (Bradycardia)</label>
                  <input
                    type="number"
                    value={formData.hrMin}
                    onChange={(e) => handleChange('hrMin', e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg p-2 font-mono font-bold text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-semibold">Max (Tachycardia)</label>
                  <input
                    type="number"
                    value={formData.hrMax}
                    onChange={(e) => handleChange('hrMax', e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg p-2 font-mono font-bold text-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">Normal adult reference: 60 - 100 bpm.</p>
            </div>

            {/* SpO2 Saturation */}
            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-[#E5EAF1] dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-blue-500 font-bold text-xs">
                <Activity className="w-4 h-4" />
                <span>Pulse Oximetry (SpO2)</span>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 font-semibold">Minimum Safe Saturation (%)</label>
                <input
                  type="number"
                  value={formData.spo2Min}
                  onChange={(e) => handleChange('spo2Min', e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg p-2 font-mono font-bold text-slate-800 dark:text-white"
                />
              </div>
              <p className="text-[10px] text-slate-400">Safe ICU baseline: ≥92%. Below 90% is critical hypoxemia.</p>
            </div>

            {/* Temperature */}
            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-[#E5EAF1] dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-teal-600 font-bold text-xs">
                <Thermometer className="w-4 h-4" />
                <span>Temperature (°C)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-semibold">Min (Hypothermia)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.tempMin}
                    onChange={(e) => handleChange('tempMin', e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg p-2 font-mono font-bold text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-semibold">Max (Pyrexia / Fever)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.tempMax}
                    onChange={(e) => handleChange('tempMax', e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg p-2 font-mono font-bold text-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">Normal core range: 36.5°C - 37.5°C.</p>
            </div>
          </div>

          {/* Engine Parameters: Debounce & Trend Rule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Persistence Debounce */}
            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-[#E5EAF1] dark:border-slate-800 space-y-2">
              <label className="text-xs font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Persistence Debounce Duration (Seconds)
              </label>
              <input
                type="number"
                min="0"
                value={formData.persistenceSeconds}
                onChange={(e) => handleChange('persistenceSeconds', e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg p-2 font-mono font-bold text-slate-800 dark:text-white"
              />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Vital reading must continuously breach threshold for this duration before an audible alarm opens, suppressing transient noise.
              </p>
            </div>

            {/* Trend Rule */}
            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-[#E5EAF1] dark:border-slate-800 space-y-3">
              <label className="text-xs font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                HR Trajectory Trend Detection Rule
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-semibold">Window (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.trendWindow}
                    onChange={(e) => handleChange('trendWindow', e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg p-2 font-mono font-bold text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-semibold">Change Threshold (%)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.trendPercent}
                    onChange={(e) => handleChange('trendPercent', e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg p-2 font-mono font-bold text-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Triggers TREND_HR if heart rate rises or drops by ≥{formData.trendPercent}% within {formData.trendWindow} minutes.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t border-[#E5EAF1] dark:border-slate-800">
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Thresholds...' : 'Save & Deploy Threshold Profile'}</span>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default ThresholdSettingsPage;
