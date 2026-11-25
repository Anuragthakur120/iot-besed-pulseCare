import React from 'react';
import { LineChart as ChartIcon } from 'lucide-react';
import { EmptyState } from './EmptyState.jsx';

/**
 * ChartEmptyState: Displayed when no telemetry readings or trends exist for the query window
 */
export function ChartEmptyState({
  title = 'No telemetry data recorded',
  description = 'No continuous telemetry readings were detected for the selected patient time window.',
  actionLabel,
  onAction,
  className = 'h-72'
}) {
  return (
    <div data-testid="chart-empty-state" className="w-full">
      <EmptyState
        icon={ChartIcon}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={onAction}
        className={className}
      />
    </div>
  );
}

export default ChartEmptyState;
