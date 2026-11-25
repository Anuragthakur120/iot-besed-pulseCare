import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleRoute } from '@/components/RoleRoute';
import { AppLayout } from '@/layouts/AppLayout';

// Pages
import {
  LandingPage,
  NotFoundPage,
  UnauthorizedPage,
  LoginPage,
  SignupPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  AcceptInvitePage,
  ChangePasswordPage,
  DoctorDashboard,
  PatientDirectory,
  PatientDetailsPage,
  DeviceManagementPage,
  PatientDashboard,
  ProfilePage,
  LiveMonitoringPage,
  HistoricalChartsPage,
  AlertsPage,
  ThresholdSettingsPage,
  ReportsPage,
  AuditLogPage
} from '@/pages';

/**
 * Smart Dashboard Dispatcher: routes user to clinical or patient portal based on authenticated role
 */
function DashboardDispatcher() {
  const { user } = useAuth();
  if (user?.role === 'patient') {
    return <Navigate to="/patient/dashboard" replace />;
  }
  return <Navigate to="/doctor/dashboard" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Landing & Marketing */}
                <Route path="/" element={<LandingPage />} />

                {/* Authentication Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/accept-invite" element={<AcceptInvitePage />} />

                {/* Force Password Change Route */}
                <Route
                  path="/change-password"
                  element={
                    <ProtectedRoute>
                      <ChangePasswordPage />
                    </ProtectedRoute>
                  }
                />

                {/* Protected Hospital Application Layout */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardDispatcher />
                    </ProtectedRoute>
                  }
                />

                {/* Doctor / Clinical Staff Portal */}
                <Route
                  path="/doctor/dashboard"
                  element={
                    <ProtectedRoute>
                      <RoleRoute allowedRoles={['doctor', 'admin']}>
                        <AppLayout>
                          <DoctorDashboard />
                        </AppLayout>
                      </RoleRoute>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/doctor/patients"
                  element={
                    <ProtectedRoute>
                      <RoleRoute allowedRoles={['doctor', 'admin']}>
                        <AppLayout>
                          <PatientDirectory />
                        </AppLayout>
                      </RoleRoute>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/doctor/patients/:patientId"
                  element={
                    <ProtectedRoute>
                      <RoleRoute allowedRoles={['doctor', 'admin']}>
                        <AppLayout>
                          <PatientDetailsPage />
                        </AppLayout>
                      </RoleRoute>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/doctor/devices"
                  element={
                    <ProtectedRoute>
                      <RoleRoute allowedRoles={['doctor', 'admin']}>
                        <AppLayout>
                          <DeviceManagementPage />
                        </AppLayout>
                      </RoleRoute>
                    </ProtectedRoute>
                  }
                />

                {/* Real-Time Live Monitoring & Telemetry */}
                <Route
                  path="/monitoring/live"
                  element={
                    <ProtectedRoute>
                      <RoleRoute allowedRoles={['doctor', 'admin']}>
                        <AppLayout>
                          <LiveMonitoringPage />
                        </AppLayout>
                      </RoleRoute>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/monitoring/history"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <HistoricalChartsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Threshold Configuration (Doctor / Admin) */}
                <Route
                  path="/doctor/thresholds"
                  element={
                    <ProtectedRoute>
                      <RoleRoute allowedRoles={['doctor', 'admin']}>
                        <AppLayout>
                          <ThresholdSettingsPage />
                        </AppLayout>
                      </RoleRoute>
                    </ProtectedRoute>
                  }
                />

                {/* Alerts Hub (Doctor / Admin / Patient) */}
                <Route
                  path="/alerts"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <AlertsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/doctor/alerts"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <AlertsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Reports & Telemetry Datasets */}
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <ReportsPage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Regulatory Audit Log (Admin only) */}
                <Route
                  path="/admin/audit"
                  element={
                    <ProtectedRoute>
                      <RoleRoute allowedRoles={['admin']}>
                        <AppLayout>
                          <AuditLogPage />
                        </AppLayout>
                      </RoleRoute>
                    </ProtectedRoute>
                  }
                />

                {/* Patient Portal */}
                <Route
                  path="/patient/dashboard"
                  element={
                    <ProtectedRoute>
                      <RoleRoute allowedRoles={['patient']}>
                        <AppLayout>
                          <PatientDashboard />
                        </AppLayout>
                      </RoleRoute>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <ProfilePage />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Error & Fallback Routes */}
                <Route path="/403" element={<UnauthorizedPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
