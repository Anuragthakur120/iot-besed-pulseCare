import React from 'react';
import { Activity, ShieldCheck, HeartPulse, Cpu, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

/**
 * Split Screen Auth Layout for Login, Signup, and Password Recovery
 */
export function AuthLayout({ children, title, subtitle }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen w-full flex bg-[#F6F8FB] dark:bg-[#070e19] text-[#0B1F3A] dark:text-slate-100 transition-colors">
      {/* Left Brand Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0B1F3A] via-[#09182d] to-[#040b15] text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Subtle background glow circles */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Activity className="w-6 h-6 animate-heartbeat" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              PulseCare <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-medium">IoT Hub</span>
            </h1>
            <p className="text-xs text-slate-400">Hospital Patient Telemetry & Monitoring System</p>
          </div>
        </div>

        {/* Animated ECG Line Visualization */}
        <div className="relative z-10 my-8 py-6 border-y border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>BEDSIDE NODE: PCD-0001</span>
            <span className="flex items-center gap-1.5 text-teal-400">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              TELEMETRY ONLINE
            </span>
          </div>
          <svg
            className="w-full h-24 overflow-visible"
            viewBox="0 0 600 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background grid line */}
            <path
              d="M0 50 H600"
              stroke="#1e293b"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            {/* Animated ECG waveform */}
            <path
              d="M0 50 L120 50 L140 45 L150 50 L170 50 L180 15 L195 85 L210 50 L230 50 L245 42 L260 50 L380 50 L400 45 L410 50 L430 50 L440 15 L455 85 L470 50 L490 50 L505 42 L520 50 L600 50"
              stroke="#14B8A6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-ecg"
            />
          </svg>
        </div>

        {/* 3 Core Clinical Feature Points */}
        <div className="relative z-10 space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Real-Time Telemetry & Vitals</h4>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Continuous SpO2, heart rate, and temperature streaming with sub-second latency.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Automated NEWS2 Early Warning</h4>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Instant clinician alerts on vital instability, trend spikes, and threshold breaches.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Hardware Encrypted Nodes</h4>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                ESP32 hardware HMAC device signatures guaranteeing patient telemetry authenticity.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-[11px] text-slate-500 border-t border-slate-800/80 pt-4 flex justify-between">
          <span>PulseCare Clinical OS • HIPAA & GDPR Architecture</span>
          <span>v1.0.0</span>
        </div>
      </div>

      {/* Right Form Container */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 overflow-y-auto">
        {/* Top Navbar: Mobile Logo + Theme Toggle */}
        <div className="flex items-center justify-between w-full max-w-md mx-auto mb-8">
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm tracking-tight text-[#0B1F3A] dark:text-white">PulseCare</span>
          </div>
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="ml-auto p-2 rounded-xl border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors shadow-sm"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Form Card */}
        <div className="w-full max-w-md mx-auto my-auto space-y-6">
          {(title || subtitle) && (
            <div className="text-left space-y-1">
              {title && (
                <h2 className="text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-white">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          )}

          <div className="bg-white dark:bg-[#0c1626] border border-[#E5EAF1] dark:border-slate-800 rounded-2xl shadow-soft p-6 sm:p-8 transition-colors">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="w-full max-w-md mx-auto mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          PulseCare IoT Monitoring • Protected by 256-bit TLS Encryption
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
