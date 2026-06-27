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
  prelude: gettext('Event'),
  analysis: gettext('Analysis'),
  handling: gettext('Handling'),
};

const getActionTitle = (action, index) => {
  const actionName = action?.tool_name || action?.type || '-';
  return `${gettext('Action')} ${index + 1}: ${actionName}`;
};

const getStepTitle = (actionGroup, index) => {
  const firstAction = actionGroup?.[0] || {};
  const step = Number.isInteger(firstAction.step) ? firstAction.step + 1 : index + 1;
  const actionName = firstAction?.tool_name || firstAction?.type || '-';
  if (actionGroup.length === 1) return `${gettext('Step')} ${step}: ${actionName}`;
  return `${gettext('Step')} ${step}`;
};

const getSubstepTitle = (action, index) => {
  const actionName = action?.tool_name || action?.type || '-';
  return `${gettext('Substep')} ${index + 1}: ${actionName}`;
};

const hasOwnKey = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const DetailValueFormatter = ({ className, value }) => (
  <pre className={`${className} agent-thought-process-pre`}>{value}</pre>
);

const PromptValueFormatter = ({ className, value }) => (
  <div className={`${className} agent-thought-process-prompt`}>{value}</div>
);

const JSONDetailValueFormatter = ({ className, value }) => (
  <AIReply
    className={className}
    message={{ ai_reply: `\`\`\`json\n${value}\n\`\`\`` }}
    projectUuid={projectUuid}
    canPreviewLinkedFile={false}
  />
);

const hasDetailValue = (value) => value !== undefined && value !== null && value !== '';

const hasPhaseContextContent = (action) => hasDetailValue(action?.prompt) || hasDetailValue(action?.input);

const buildPhaseTextNode = (phase, actions = [], field, label) => {
  const phaseActions = actions.filter((action) => hasDetailValue(action?.[field]));
  if (phaseActions.length !== 1) return null;

  return {
    id: `phase-${phase}-${field}`,
    name: label,
    children: [
      {
        value: phaseActions[0][field],
        formatter: PromptValueFormatter,
      }
    ],
  };
};

const buildDetailsChildren = (details, options = {}) => {
  if (!details || typeof details !== 'object') return [];

  const { excludePrompt = false } = options;

  return THOUGHT_PROCESS_DETAIL_FIELDS
    .map((field) => {
      if (excludePrompt && field.key === 'prompt') return null;
      if (!hasOwnKey(details, field.key)) return null;
      const fieldValue = details[field.key];
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') return null;

      return {
        name: `• ${field.label}`,
        value: shouldHighlightDetailsAsJSON(field.key) ? formatDetailsJSONValue(fieldValue) : formatDetailsValue(fieldValue),
        formatter: shouldHighlightDetailsAsJSON(field.key) ? JSONDetailValueFormatter : DetailValueFormatter,
      };
    })
    .filter(Boolean);
};

const getValidPhase = (phase) => {
  if (typeof phase !== 'string') return null;
  const normalizedPhase = phase.toLowerCase();
  return PHASE_ORDER.includes(normalizedPhase) ? normalizedPhase : null;
};

const collectRunActions = (run) => {
  const { items = [], actions = [] } = run || {};
  const itemActions = items.flatMap((item) => item.actions || []);
  return [...itemActions, ...actions];
};

const groupActionsByStep = (actions = []) => {
  const groups = [];
  const groupIndexes = new Map();

  actions.forEach((action) => {
    const hasStep = Number.isInteger(action?.step);
    const groupKey = hasStep ? `step-${action.step}` : `action-${groups.length}`;
    if (!groupIndexes.has(groupKey)) {
      groupIndexes.set(groupKey, groups.length);
      groups.push([]);
    }
    groups[groupIndexes.get(groupKey)].push(action);
  });

  return groups;
};

const buildActionDetailNode = (action, actionIndex, options = {}) => {
  const children = buildDetailsChildren(action, options);
  if (children.length === 0) return null;

  return {
    id: action.id || `action-${actionIndex}`,
    name: getActionTitle(action, actionIndex),
    children,
  };
};

const buildPhaseGroupedActionNodes = (actions = []) => {
  const actionsByPhase = PHASE_ORDER.reduce((acc, phase) => {
    acc[phase] = [];
    return acc;
  }, {});

  actions.forEach((action) => {
    if (!hasToolDetailsContent(action) && !hasPhaseContextContent(action)) return;
    const phase = getValidPhase(action.phase);
    if (!phase) return;
    actionsByPhase[phase].push(action);
  });

  return PHASE_ORDER.map((phase) => {
    const phaseActions = actionsByPhase[phase];
    if (phaseActions.length === 0) return null;

    const promptNode = buildPhaseTextNode(phase, phaseActions, 'prompt', gettext('Prompt'));
    const inputNode = buildPhaseTextNode(phase, phaseActions, 'input', gettext('Input'));
    const shouldExcludeActionPrompt = Boolean(promptNode);
    const phaseContextNodes = [promptNode, inputNode].filter(Boolean);

    const actionNodes = groupActionsByStep(phaseActions).map((actionGroup, groupIndex) => {
      if (actionGroup.length === 1) {
        const actionNode = buildActionDetailNode(actionGroup[0], groupIndex, { excludePrompt: shouldExcludeActionPrompt });
        if (!actionNode) return null;
        return {
          ...actionNode,
          id: actionNode.id || `${phase}-step-${groupIndex}`,
          name: getStepTitle(actionGroup, groupIndex),
        };
      }

      const substepNodes = actionGroup.map((action, substepIndex) => {
        const actionNode = buildActionDetailNode(action, substepIndex, { excludePrompt: shouldExcludeActionPrompt });
        if (!actionNode) return null;
        return {
          ...actionNode,
          id: action.id || `${phase}-step-${groupIndex}-substep-${substepIndex}`,
          name: getSubstepTitle(action, substepIndex),
        };
      }).filter(Boolean);

      if (substepNodes.length === 0) return null;
      return {
        id: `${phase}-step-${actionGroup[0]?.step ?? groupIndex}`,
        name: getStepTitle(actionGroup, groupIndex),
        children: [
          {
            id: `${phase}-step-${actionGroup[0]?.step ?? groupIndex}-substeps`,
            name: gettext('Substep'),
            children: substepNodes,
          },
        ],
      };
    }).filter(Boolean);

    return {
      id: `phase-${phase}`,
      name: PHASE_LABELS[phase],
      children: [...phaseContextNodes, ...actionNodes],
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
