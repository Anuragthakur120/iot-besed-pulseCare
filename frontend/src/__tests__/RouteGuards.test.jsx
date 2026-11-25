import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleRoute } from '@/components/RoleRoute';
import * as AuthContextModule from '@/context/AuthContext';

describe('PulseCare Frontend: Route Guards (ProtectedRoute & RoleRoute)', () => {
  it('ProtectedRoute redirects unauthenticated visitor to /login', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false
    });

    render(
      <MemoryRouter initialEntries={['/doctor/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page Target</div>} />
          <Route
            path="/doctor/dashboard"
            element={
              <ProtectedRoute>
                <div>Secure Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page Target')).toBeInTheDocument();
    expect(screen.queryByText('Secure Content')).not.toBeInTheDocument();
  });

  it('ProtectedRoute redirects user with mustChangePassword to /change-password', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: { name: 'Dr. Jane', role: 'doctor', mustChangePassword: true },
      isLoading: false
    });

    render(
      <MemoryRouter initialEntries={['/doctor/dashboard']}>
        <Routes>
          <Route path="/change-password" element={<div>Change Password Mandatory</div>} />
          <Route
            path="/doctor/dashboard"
            element={
              <ProtectedRoute>
                <div>Doctor Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Change Password Mandatory')).toBeInTheDocument();
    expect(screen.queryByText('Doctor Content')).not.toBeInTheDocument();
  });

  it('ProtectedRoute renders protected content for authenticated user with regular password', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: { name: 'Dr. Jane', role: 'doctor', mustChangePassword: false },
      isLoading: false
    });

    render(
      <MemoryRouter initialEntries={['/doctor/dashboard']}>
        <Routes>
          <Route
            path="/doctor/dashboard"
            element={
              <ProtectedRoute>
                <div>Confidential Patient Records</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Confidential Patient Records')).toBeInTheDocument();
  });

  it('RoleRoute blocks patient from accessing doctor routes and redirects to /patient/dashboard', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: { name: 'John Doe', role: 'patient' },
      isLoading: false
    });

    render(
      <MemoryRouter initialEntries={['/doctor/monitoring']}>
        <Routes>
          <Route path="/patient/dashboard" element={<div>Patient Portal Dashboard</div>} />
          <Route
            path="/doctor/monitoring"
            element={
              <RoleRoute allowedRoles={['doctor', 'admin']}>
                <div>Doctor Live ICU Monitor</div>
              </RoleRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Patient Portal Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Doctor Live ICU Monitor')).not.toBeInTheDocument();
  });

  it('RoleRoute allows doctor to access doctor-designated routes', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: { name: 'Dr. Gregory House', role: 'doctor' },
      isLoading: false
    });

    render(
      <MemoryRouter initialEntries={['/doctor/monitoring']}>
        <Routes>
          <Route
            path="/doctor/monitoring"
            element={
              <RoleRoute allowedRoles={['doctor', 'admin']}>
                <div>Doctor Live ICU Monitor</div>
              </RoleRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Doctor Live ICU Monitor')).toBeInTheDocument();
  });
});
