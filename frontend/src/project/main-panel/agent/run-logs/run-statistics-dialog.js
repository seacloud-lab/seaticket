import React, { useMemo } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { ModalHeader } from '@/components';
import { gettext } from '@/constants';

import './run-statistics-dialog.css';

const parseStatistics = (statisticsStr) => {
  if (!statisticsStr) return null;
  try {
    return JSON.parse(statisticsStr);
  } catch (e) {
    return null;
  }
};

const formatDuration = (durationMs) => {
  if (durationMs === null || durationMs === undefined) return '-';
  return (durationMs / 1000).toFixed(2);
};

const RunStatisticsDialog = ({ run, onToggle }) => {
  const { items = [], actions = [] } = run;

  const allActions = useMemo(() => {
    const result = [];
    items.forEach((item) => {
      (item.actions || []).forEach((action) => {
        result.push({
          ...action,
          sourceTitle: item.source_title,
        });
      });
    });
    if (items.length === 0 && actions.length > 0) {
      actions.forEach((action) => {
        result.push(action);
      });
    }
    return result;
  }, [items, actions]);

  const { stepStats, totals } = useMemo(() => {
    const stepStats = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalDurationMs = 0;

    allActions.forEach((action, index) => {
      const stats = parseStatistics(action.statistics);
      const inputTokens = stats?.input_tokens || 0;
      const outputTokens = stats?.output_tokens || 0;
      const stepTotalTokens = stats?.total_tokens || 0;
      const durationMs = stats?.duration_ms || 0;

      stepStats.push({
        step: index + 1,
        toolName: action.tool_name || action.type || '-',
        inputTokens,
        outputTokens,
        totalTokens: stepTotalTokens,
        durationMs,
        durationSec: formatDuration(durationMs),
      });

      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      totalTokens += stepTotalTokens;
      totalDurationMs += durationMs;
    });

    return {
      stepStats,
      totals: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens,
        durationMs: totalDurationMs,
        durationSec: formatDuration(totalDurationMs),
      },
    };
  }, [allActions]);

  return (
    <Modal isOpen={true} toggle={onToggle} className="run-statistics-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Running log details')}</ModalHeader>
      <ModalBody>
        <div className="run-statistics-content">
          <div className="run-statistics-section">
            <h4 className="run-statistics-section-title">{gettext('Summary')}</h4>
            <div className="run-statistics-summary">
              <div className="summary-item">
                <span className="summary-label">{gettext('Total steps')}:</span>
                <span className="summary-value">{stepStats.length}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{gettext('Total duration')}:</span>
                <span className="summary-value">{totals.durationSec} s</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">{gettext('Total tokens')}:</span>
                <span className="summary-value">
                  {totals.totalTokens} (↑{totals.inputTokens}, ↓{totals.outputTokens})
                </span>
              </div>
            </div>
          </div>

          <div className="run-statistics-section">
            <h4 className="run-statistics-section-title">{gettext('Step details')}</h4>
            <div className="run-statistics-table-wrapper">
              <table className="run-statistics-table">
                <thead>
                  <tr>
                    <th>{gettext('Step')}</th>
                    <th>{gettext('Tool')}</th>
                    <th>{gettext('Duration')} (s)</th>
                    <th>{gettext('Input tokens')}</th>
                    <th>{gettext('Output tokens')}</th>
                    <th>{gettext('Total tokens')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stepStats.map((step) => (
                    <tr key={step.step}>
                      <td>{step.step}</td>
                      <td className="tool-name-cell" title={step.toolName}>{step.toolName}</td>
                      <td>{step.durationSec}</td>
                      <td>{step.inputTokens}</td>
                      <td>{step.outputTokens}</td>
                      <td>{step.totalTokens}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="totals-row">
                    <td colSpan="2"><strong>{gettext('Total')}</strong></td>
                    <td><strong>{totals.durationSec}</strong></td>
                    <td><strong>{totals.inputTokens}</strong></td>
                    <td><strong>{totals.outputTokens}</strong></td>
                    <td><strong>{totals.totalTokens}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default RunStatisticsDialog;
