import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/**
 * RoleRoute: Restricts access to specific clinical user roles
 */
export function RoleRoute({ children, allowedRoles = [] }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect patients attempting doctor routes to their dashboard
    if (user.role === 'patient') {
      return <Navigate to="/patient/dashboard" replace />;
    }
    // Redirect doctors/admins attempting patient routes to doctor dashboard
    if (user.role === 'doctor' || user.role === 'admin') {
      return <Navigate to="/doctor/dashboard" replace />;
    }
    return <Navigate to="/403" replace />;
  }

  return children;
}

export default RoleRoute;
