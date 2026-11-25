import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  HeartPulse,
  Cpu,
  Cloud,
  LayoutDashboard,
  ShieldCheck,
  Bell,
  Stethoscope,
  ArrowRight,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/Button';

export function LandingPage() {
  const { isAuthenticated, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const dashboardPath = user?.role === 'patient' ? '/patient/dashboard' : '/doctor/dashboard';

  return (
    <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#070e19] text-[#0B1F3A] dark:text-slate-100 transition-colors">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#0c1626]/80 backdrop-blur border-b border-[#E5EAF1] dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-[#0B1F3A] dark:text-white">PulseCare</span>
              <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold">
                CLINICAL IoT
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {isAuthenticated ? (
              <Link to={dashboardPath}>
                <Button variant="primary" size="sm" rightIcon={ArrowRight}>
                  Open Dashboard
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="outline" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button variant="primary" size="sm">
                    Register as Patient
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-16 px-6">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300 text-xs font-semibold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
            <span>Next-Generation Patient Telemetry & Early Warning System</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[#0B1F3A] dark:text-white max-w-4xl mx-auto leading-tight">
            Continuous Hospital Telemetry with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-blue-600">
              Zero Clinical Compromise.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            PulseCare bridges bedside ESP32 multi-sensor nodes with real-time web telemetry and NEWS2 predictive analytics, providing clinicians with instant alerts before critical events occur.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link to="/signup">
              <Button variant="primary" size="lg" rightIcon={ArrowRight}>
                Get Started as Patient
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" leftIcon={Stethoscope}>
                Doctor & Operator Portal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works (ESP32 -> Cloud -> Dashboard) */}
      <section className="py-16 px-6 border-y border-[#E5EAF1] dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-[#0B1F3A] dark:text-white">How PulseCare Works</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Three-tier medical data pipeline engineered for 99.99% uptime and low-latency clinical alerting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Step 1 */}
            <div className="p-6 rounded-card border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-[#0c1626] shadow-soft space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-teal-600 dark:text-teal-400 uppercase">
                  Step 01: Hardware Sensor
                </span>
                <h3 className="text-base font-bold text-[#0B1F3A] dark:text-white">ESP32 Bedside Nodes</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Optical pulse oximeter (MAX30102) and precision thermistors capture continuous patient vitals with HMAC cryptographic signing.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-card border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-[#0c1626] shadow-soft space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Cloud className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase">
                  Step 02: Ingestion & Storage
                </span>
                <h3 className="text-base font-bold text-[#0B1F3A] dark:text-white">MongoDB Time-Series</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  High-frequency vitals stream into dedicated MongoDB time-series buckets with automatic 30-day retention policies.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-card border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-[#0c1626] shadow-soft space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 uppercase">
                  Step 03: Clinical Dashboard
                </span>
                <h3 className="text-base font-bold text-[#0B1F3A] dark:text-white">Real-Time Web Sockets</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Socket.IO broadcasts live waveforms to ward monitoring terminals and patient portals with sub-second latency.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-[#0B1F3A] dark:text-white">Core Clinical Capabilities</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Designed according to modern hospital ICU workflows and patient safety guidelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-card border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-[#0c1626] shadow-soft flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#0B1F3A] dark:text-white">Live Vitals Streaming</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Real-time heart rate, SpO2, and body temperature charts with sensor detachment detection (never reporting zero).
                </p>
              </div>
            </div>

            <div className="p-6 rounded-card border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-[#0c1626] shadow-soft flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#0B1F3A] dark:text-white">NEWS2 Clinical Alerts</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Automatic debounce timers and fast-trajectory trend recognition prevent alarm fatigue while catching deterioration early.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-card border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-[#0c1626] shadow-soft flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#0B1F3A] dark:text-white">Role-Based Patient Isolation</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Patients strictly access only their personal health timeline. Doctors manage assigned hospital wards securely.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-card border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-[#0c1626] shadow-soft flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#0B1F3A] dark:text-white">Multi-Visit Trend Analytics</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Session summary metrics (min, max, median, quality %) and visit-to-visit delta comparisons.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Medical Disclaimer Banner */}
      <section className="py-8 px-6 bg-slate-100 dark:bg-slate-900 border-t border-[#E5EAF1] dark:border-slate-800">
        <div className="max-w-4xl mx-auto p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs leading-relaxed text-center">
          <p className="font-bold uppercase tracking-wider mb-1">Medical Device Notice & Disclaimer</p>
          PulseCare IoT patient monitoring software and associated sensor nodes are assistive telemetry systems designed to aid clinical observation. Measurements (including photoplethysmography SpO2 calculations) are estimated approximations and are not intended to replace certified arterial blood gas evaluations or ICU diagnostic workstations. Always correlate telemetry with clinical judgment.
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[#E5EAF1] dark:border-slate-800 text-center text-xs text-slate-500">
        <p>© 2026 PulseCare Hospital Monitoring Systems • Built for Modern Healthcare</p>
      </footer>
    </div>
  );
}

export default LandingPage;
