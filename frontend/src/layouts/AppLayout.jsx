import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
  Users,
  Cpu,
  Bell,
  Search,
  Settings,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  User,
  HeartPulse,
  Key,
  FileText,
  Sliders,
  Shield,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { cn } from '@/utils/cn';
import { api } from '@/services/api';
import { socket } from '@/services/socket';
import { playAlertBeep, isAudioMuted, setAudioMuted } from '@/utils/audioAlert';

/**
 * Main Hospital Application Layout with collapsible sidebar, top bar, and mobile navigation
 */
export function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openAlertsCount, setOpenAlertsCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [audioMuted, setAudioMutedState] = useState(isAudioMuted());

  const isDoctorOrAdmin = user?.role === 'doctor' || user?.role === 'admin';

  // Fetch open alerts count & list
  const fetchOpenAlerts = async () => {
    try {
      const res = await api.get('/alerts?status=open&limit=5');
      if (res.data?.success) {
        setOpenAlertsCount(res.data.data.stats?.open || 0);
        setRecentAlerts(res.data.data.alerts || []);
      }
    } catch (e) {
      // ignore in offline/unauthorized state
    }
  };

  useEffect(() => {
    fetchOpenAlerts();
  }, [user]);

  // Listen to Socket.IO for real-time alert bell notification
  useEffect(() => {
    if (!socket) return;

    const onAlertNew = (alert) => {
      setOpenAlertsCount((prev) => prev + 1);
      setRecentAlerts((prev) => [alert, ...prev.slice(0, 4)]);
      playAlertBeep(alert.severity);
    };

    const onAlertResolved = () => {
      setOpenAlertsCount((prev) => Math.max(0, prev - 1));
      fetchOpenAlerts();
    };

    socket.on('alert:new', onAlertNew);
    socket.on('alert:resolved', onAlertResolved);

    return () => {
      socket.off('alert:new', onAlertNew);
      socket.off('alert:resolved', onAlertResolved);
    };
  }, []);

  const toggleAudio = () => {
    const next = !audioMuted;
    setAudioMutedState(next);
    setAudioMuted(next);
  };

  const navLinks = isDoctorOrAdmin
    ? [
        { label: 'Ward Dashboard', path: '/doctor/dashboard', icon: Activity },
        { label: 'Patient Directory', path: '/doctor/patients', icon: Users },
        { label: 'Hardware Devices', path: '/doctor/devices', icon: Cpu },
        { label: 'Clinical Alerts', path: '/alerts', icon: ShieldAlert, badge: openAlertsCount || undefined },
        { label: 'Threshold Profiles', path: '/doctor/thresholds', icon: Sliders },
        { label: 'Clinical Reports', path: '/reports', icon: FileText },
        ...(user?.role === 'admin' ? [{ label: 'Audit Trail', path: '/admin/audit', icon: Shield }] : [])
      ]
    : [
        { label: 'My Vitals Dashboard', path: '/patient/dashboard', icon: HeartPulse },
        { label: 'My Health Alerts', path: '/alerts', icon: ShieldAlert, badge: openAlertsCount || undefined },
        { label: 'My Medical Reports', path: '/reports', icon: FileText },
        { label: 'My Clinical Profile', path: '/profile', icon: User }
      ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim() && isDoctorOrAdmin) {
      navigate(`/doctor/patients?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F6F8FB] dark:bg-[#070e19] text-[#0B1F3A] dark:text-slate-100 transition-colors">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col justify-between border-r border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-[#0c1626] transition-all duration-300 z-30 shrink-0 sticky top-0 h-screen',
          sidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-[#E5EAF1] dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <h1 className="text-sm font-bold tracking-tight text-[#0B1F3A] dark:text-white">PulseCare</h1>
                <p className="text-[10px] text-slate-400 font-mono">HOSPITAL OS</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group',
                    isActive
                      ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#0B1F3A] dark:hover:text-slate-200'
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                {!sidebarCollapsed && item.badge && (
                  <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer User Card */}
        <div className="p-3 border-t border-[#E5EAF1] dark:border-slate-800/80">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-[#E5EAF1] dark:border-slate-800/60">
            <Avatar name={user?.name} size="sm" />
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#0B1F3A] dark:text-slate-100 truncate">{user?.name}</p>
                <Badge variant={isDoctorOrAdmin ? 'info' : 'success'} size="sm" className="mt-0.5">
                  {user?.role}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 h-16 bg-white/90 dark:bg-[#0c1626]/90 backdrop-blur border-b border-[#E5EAF1] dark:border-slate-800 flex items-center justify-between px-4 sm:px-8">
          {/* Global Search Bar (Doctors/Admin) */}
          <div className="flex items-center gap-4 flex-1 max-w-md">
            {isDoctorOrAdmin && (
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search patient by ID, name, or email... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs rounded-input py-2 pl-9 pr-12 text-[#0B1F3A] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
                <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                  ⌘K
                </kbd>
              </form>
            )}
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setBellOpen((prev) => !prev)}
                aria-label="View alerts"
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {openAlertsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center px-1 ring-2 ring-white dark:ring-[#0c1626] animate-pulse">
                    {openAlertsCount > 99 ? '99+' : openAlertsCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#0c1626] border border-[#E5EAF1] dark:border-slate-800 rounded-2xl shadow-2xl p-3 z-50 text-xs space-y-3 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E5EAF1] dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-500" />
                        <span className="font-bold text-[#0B1F3A] dark:text-white">Active Alarms ({openAlertsCount})</span>
                      </div>
                      <button
                        onClick={toggleAudio}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 flex items-center gap-1 text-[11px]"
                        title={audioMuted ? 'Unmute Audio Beep' : 'Mute Audio Beep'}
                      >
                        {audioMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 text-teal-600" />}
                        <span>{audioMuted ? 'Muted' : 'Sound On'}</span>
                      </button>
                    </div>

                    {recentAlerts.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 space-y-1">
                        <CheckCircle2 className="w-6 h-6 text-teal-500 mx-auto opacity-70" />
                        <p className="font-medium text-slate-600 dark:text-slate-300">All systems normal</p>
                        <p className="text-[10px]">No active telemetry alarms detected.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                        {recentAlerts.map((a) => (
                          <div key={a._id} className="pt-2 first:pt-0 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{a.type}</span>
                              <Badge variant={a.severity === 'critical' ? 'danger' : 'warning'} size="sm">
                                {a.severity}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {a.patient?.name ? `Patient: ${a.patient.name} • ` : ''}Value: {typeof a.value === 'object' ? JSON.stringify(a.value) : a.value}
                            </p>
                            <p className="text-[9px] text-slate-400">{new Date(a.triggeredAt).toLocaleTimeString()}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-[#E5EAF1] dark:border-slate-800">
                      <button
                        onClick={() => {
                          setBellOpen(false);
                          navigate('/alerts');
                        }}
                        className="w-full py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-semibold text-center text-xs transition-colors"
                      >
                        Go to Full Alerts Hub →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Avatar name={user?.name} size="sm" />
                <span className="hidden md:inline-block text-xs font-semibold text-[#0B1F3A] dark:text-slate-200">
                  {user?.name?.split(' ')[0]}
                </span>
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#0c1626] border border-[#E5EAF1] dark:border-slate-800 rounded-2xl shadow-xl p-2 z-50 text-xs">
                    <div className="p-3 border-b border-[#E5EAF1] dark:border-slate-800">
                      <p className="font-bold text-[#0B1F3A] dark:text-white truncate">{user?.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                      {user?.patientId && (
                        <p className="text-[10px] font-mono text-teal-600 dark:text-teal-400 mt-1">
                          ID: {user?.patientId}
                        </p>
                      )}
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          navigate('/profile');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <span>My Profile & Settings</span>
                      </button>
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          navigate('/change-password');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                      >
                        <Key className="w-4 h-4 text-slate-400" />
                        <span>Change Password</span>
                      </button>
                    </div>
                    <div className="pt-1 border-t border-[#E5EAF1] dark:border-slate-800">
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left font-medium"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-white dark:bg-[#0c1626] border-t border-[#E5EAF1] dark:border-slate-800 flex items-center justify-around z-30 px-2 shadow-lg">
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition-colors',
                  isActive
                    ? 'text-teal-600 dark:text-teal-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.label.split(' ')[0]}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

export default AppLayout;
