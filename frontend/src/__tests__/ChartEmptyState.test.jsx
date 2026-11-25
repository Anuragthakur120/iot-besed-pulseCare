import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChartEmptyState } from '@/components/ChartEmptyState';

describe('PulseCare Frontend: Chart Empty State Component', () => {
  it('renders default empty state message when no telemetry readings exist', () => {
    render(<ChartEmptyState />);

    expect(screen.getByTestId('chart-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No telemetry data recorded')).toBeInTheDocument();
    expect(
      screen.getByText('No continuous telemetry readings were detected for the selected patient time window.')
    ).toBeInTheDocument();
  });

  it('renders custom title and clinical description when provided', () => {
    render(
      <ChartEmptyState
        title="Zero SpO2 Trends"
        description="The sensor was detached during this 1-hour interval."
      />
    );

    expect(screen.getByText('Zero SpO2 Trends')).toBeInTheDocument();
    expect(screen.getByText('The sensor was detached during this 1-hour interval.')).toBeInTheDocument();
  });

  it('renders action button and triggers callback on click', () => {
    const handleRefresh = vi.fn();

    render(
      <ChartEmptyState
        actionLabel="Refresh Telemetry"
        onAction={handleRefresh}
      />
    );

    const button = screen.getByRole('button', { name: /refresh telemetry/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });
});
