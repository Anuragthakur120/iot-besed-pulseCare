import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/LoginPage';

// Mock contexts
const mockLogin = vi.fn();
const mockToast = { success: vi.fn(), error: vi.fn() };
const mockNavigate = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: false,
    user: null,
    isLoading: false
  })
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => mockToast
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('PulseCare Frontend: LoginPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email input, password input, and Sign In button', () => {
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(container.querySelector('#password-input')).toBeInTheDocument();
    expect(container.querySelector('button[type="submit"]')).toBeInTheDocument();
  });

  it('displays validation error if email or password are empty on submit', async () => {
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const form = container.querySelector('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/please enter both email address and password/i)).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login with email and password and navigates on success', async () => {
    mockLogin.mockResolvedValueOnce({
      name: 'Dr. Sarah Connor',
      role: 'doctor',
      mustChangePassword: false
    });

    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = container.querySelector('#password-input');
    const submitBtn = container.querySelector('button[type="submit"]');

    fireEvent.change(emailInput, { target: { value: 'doctor@pulsecare.dev' } });
    fireEvent.change(passwordInput, { target: { value: 'Password@123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('doctor@pulsecare.dev', 'Password@123', true);
      expect(mockNavigate).toHaveBeenCalledWith('/doctor/dashboard', { replace: true });
    });
  });

  it('displays server error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid email or password'));

    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = container.querySelector('#password-input');
    const submitBtn = container.querySelector('button[type="submit"]');

    fireEvent.change(emailInput, { target: { value: 'doctor@pulsecare.dev' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPass!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });
});
