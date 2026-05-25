import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { CenteredLoading, ModalHeader } from '@/components';
import { gettext } from '@/constants';
import AIReply from '@/project/components/ai-reply';
import ProcessDetails from '@/project/components/thought-process/process-details';
import { agentAPI } from '@/project/api';
import {
  THOUGHT_PROCESS_DETAIL_FIELDS,
  formatDetailsJSONValue,
  formatDetailsValue,
  hasToolDetailsContent,
  shouldHighlightDetailsAsJSON,
} from './tool-details-content';

import './thought-process-dialog.css';

const { projectUuid } = window.app.pageOptions;

const PRIMARY_SECTION = {
  key: 'action_steps',
  icon: 'action-steps',
  isPrimaryContainer: true,
};
const PHASE_ORDER = ['prelude', 'analysis', 'handling'];
const PHASE_LABELS = {
  prelude: gettext('Events'),
  analysis: gettext('Analysis'),
  handling: gettext('Handling'),
};

const getActionTitle = (action, index) => {
  const actionName = action?.tool_name || action?.type || '-';
  return `${gettext('Action')} ${index + 1}: ${actionName}`;
};

const hasOwnKey = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const DetailValueFormatter = ({ className, value }) => (
  <pre className={`${className} agent-thought-process-pre`}>{value}</pre>
);

const JSONDetailValueFormatter = ({ className, value }) => (
  <AIReply
    className={className}
    message={{ ai_reply: `\`\`\`json\n${value}\n\`\`\`` }}
    projectUuid={projectUuid}
    canPreviewLinkedFile={false}
  />
);

const buildDetailsChildren = (details) => {
  if (!details || typeof details !== 'object') return [];

  return THOUGHT_PROCESS_DETAIL_FIELDS
    .map((field) => {
      if (!hasOwnKey(details, field.key)) return null;
      const fieldValue = details[field.key];
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') return null;

      return {
        name: field.label,
        value: shouldHighlightDetailsAsJSON(field.key) ? formatDetailsJSONValue(fieldValue) : formatDetailsValue(fieldValue),
        formatter: shouldHighlightDetailsAsJSON(field.key) ? JSONDetailValueFormatter : DetailValueFormatter,
      };
    })
    .filter(Boolean);
};

const getValidPhase = (details) => {
  const phase = details?.phase;
  if (typeof phase !== 'string') return null;
  const normalizedPhase = phase.toLowerCase();
  return PHASE_ORDER.includes(normalizedPhase) ? normalizedPhase : null;
};

const collectRunActions = (run) => {
  const { items = [], actions = [] } = run || {};
  const itemActions = items.flatMap((item) => item.actions || []);
  return [...itemActions, ...actions];
};

const buildPhaseGroupedActionNodes = (actions = []) => {
  const actionsByPhase = PHASE_ORDER.reduce((acc, phase) => {
    acc[phase] = [];
    return acc;
  }, {});

  actions.forEach((action) => {
    if (!hasToolDetailsContent(action?.details)) return;
    const phase = getValidPhase(action.details);
    if (!phase) return;
    actionsByPhase[phase].push(action);
  });

  return PHASE_ORDER.map((phase) => {
    const phaseActions = actionsByPhase[phase];
    if (phaseActions.length === 0) return null;

    const actionNodes = phaseActions.map((action, actionIndex) => ({
      id: action.id || `${phase}-action-${actionIndex}`,
      name: getActionTitle(action, actionIndex),
      children: buildDetailsChildren(action.details),
    }));

    return {
      id: `phase-${phase}`,
      name: PHASE_LABELS[phase],
      children: actionNodes,
    };
  }).filter(Boolean);
};

const buildThoughtProcessTree = (run) => {
  const phaseNodes = buildPhaseGroupedActionNodes(collectRunActions(run));
  return phaseNodes.map((node) => ({
    ...PRIMARY_SECTION,
    ...node,
  }));
};

const ThoughtProcessDialog = ({ runId, onToggle }) => {
  const [run, setRun] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setRun(null);

    agentAPI.getAgentRunDetails(projectUuid, runId, { includeDetails: true }).then((res) => {
      if (!isMounted) return;
      setRun(res.data);
    }).catch(() => {
      if (!isMounted) return;
      setRun(null);
    }).finally(() => {
      if (!isMounted) return;
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [runId]);

  const thoughtProcessTree = useMemo(() => buildThoughtProcessTree(run), [run]);

  return (
    <Modal isOpen={true} toggle={onToggle} className="seaqa-ai-thought-process-dialog agent-thought-process-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Thought process')}</ModalHeader>
      <ModalBody>
        {isLoading ? (
          <div className="agent-thought-process-loading">
            <CenteredLoading />
          </div>
        ) : thoughtProcessTree.length === 0 ? (
          <div className="agent-thought-process-empty">{gettext('No thought process details')}</div>
        ) : (
          <div className="seaqa-ai-thought-process agent-thought-process-content">
            {thoughtProcessTree.map((node) => (
              <ProcessDetails value={node} key={node.id} />
            ))}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default ThoughtProcessDialog;
