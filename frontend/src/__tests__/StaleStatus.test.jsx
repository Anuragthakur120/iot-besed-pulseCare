import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPill } from '@/components/StatusPill';

describe('PulseCare Frontend: Stale & Telemetry Status Component (StatusPill)', () => {
  it('renders LIVE state with green accent and pulsing animation element', () => {
    const { container } = render(<StatusPill status="LIVE" />);

    expect(screen.getByText('LIVE')).toBeInTheDocument();
    // Verify animate-ping exists for live telemetry
    const pingElement = container.querySelector('.animate-ping');
    expect(pingElement).toBeInTheDocument();
  });

  it('renders STALE telemetry state with amber styling and no ping animation', () => {
    const { container } = render(<StatusPill status="STALE" />);

    expect(screen.getByText('STALE')).toBeInTheDocument();
    const pill = container.querySelector('span');
    expect(pill.className).toContain('text-amber-700');
    expect(container.querySelector('.animate-ping')).toBeNull();
  });

  it('renders DISCONNECTED state with danger rose styling', () => {
    const { container } = render(<StatusPill status="DISCONNECTED" />);

    expect(screen.getByText('DISCONNECTED')).toBeInTheDocument();
    const pill = container.querySelector('span');
    expect(pill.className).toContain('text-rose-700');
  });

  it('renders OFFLINE state accurately', () => {
    render(<StatusPill status="OFFLINE" />);
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
  });

  it('renders NO DATA fallback when no telemetry has been received', () => {
    render(<StatusPill status="NO DATA" />);
    expect(screen.getByText('NO DATA')).toBeInTheDocument();
  });

  it('allows custom label override on the telemetry badge', () => {
    render(<StatusPill status="STALE" label="Delayed Telemetry (>15s)" />);
    expect(screen.getByText('Delayed Telemetry (>15s)')).toBeInTheDocument();
  });
});
