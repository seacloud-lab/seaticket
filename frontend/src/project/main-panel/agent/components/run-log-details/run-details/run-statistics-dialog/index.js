import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { ModalHeader } from '@/components';
import { gettext } from '@/constants';
import { agentAPI } from '@/project/api';

import './index.css';

const { projectUuid } = window.app.pageOptions;

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

const PHASE_ORDER = ['prelude', 'analysis', 'handling'];
const PHASE_LABELS = {
  prelude: gettext('Prelude'),
  analysis: gettext('Analysis'),
  handling: gettext('Handling'),
};

const getActionStepIndex = (action) => {
  const step = action?.step;
  if (Number.isInteger(step)) return step;
  if (typeof step === 'string' && step.trim() !== '') {
    const parsedStep = Number(step);
    if (Number.isInteger(parsedStep)) return parsedStep;
  }
  return null;
};

const getToolName = (action) => action.tool_name || action.type || '-';

const getPhaseStatistics = (actions = []) => {
  const stepStats = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  let totalDurationMs = 0;

  actions.forEach((action, index) => {
    const stats = parseStatistics(action.statistics);
    const inputTokens = stats?.input_tokens || 0;
    const outputTokens = stats?.output_tokens || 0;
    const stepTotalTokens = stats?.total_tokens || 0;
    const durationMs = stats?.duration_ms || 0;
    const step = getActionStepIndex(action);

    stepStats.push({
      id: action.id || `action-${index}`,
      step: step !== null ? step + 1 : index + 1,
      toolName: getToolName(action),
      inputTokens,
      outputTokens,
      totalTokens: stepTotalTokens,
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
};

const RunStatisticsDialog = ({ run: initialRun, runId, onToggle }) => {
  const [run, setRun] = useState(initialRun);

  useEffect(() => {
    let isMounted = true;
    setRun(initialRun);

    agentAPI.getAgentRunDetails(projectUuid, runId).then((res) => {
      if (!isMounted) return;
      setRun(res.data);
    }).catch(() => {
      if (!isMounted) return;
      setRun(initialRun);
    });

    return () => {
      isMounted = false;
    };
  }, [initialRun, runId]);

  const phaseStatistics = useMemo(() => {
    const phaseActions = PHASE_ORDER.reduce((phases, phase) => {
      phases[phase] = { actions: [], exists: false };
      return phases;
    }, {});

    (run?.items || []).forEach((item) => {
      const actionsByPhase = item.actions || {};
      PHASE_ORDER.forEach((phase) => {
        if (!actionsByPhase[phase]) return;
        phaseActions[phase].exists = true;
        phaseActions[phase].actions.push(...(actionsByPhase[phase].actions || []));
      });
    });

    return PHASE_ORDER.filter((phase) => phaseActions[phase].exists).map((phase) => ({
      phase,
      ...getPhaseStatistics(phaseActions[phase].actions),
    }));
  }, [run]);

  return (
    <Modal isOpen={true} toggle={onToggle} className="run-statistics-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Running log details')}</ModalHeader>
      <ModalBody>
        <div className="run-statistics-content">
          {phaseStatistics.map(({ phase, stepStats, totals }) => (
            <section className="run-statistics-section" key={phase}>
              <h4 className="run-statistics-section-title">{PHASE_LABELS[phase]}</h4>
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
                      <tr key={step.id}>
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
            </section>
          ))}
        </div>
      </ModalBody>
    </Modal>
  );
};

export default RunStatisticsDialog;
