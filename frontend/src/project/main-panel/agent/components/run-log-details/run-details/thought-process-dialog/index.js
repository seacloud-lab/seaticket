import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { CenteredLoading, CustomizeMarkdownViewer, ModalHeader } from '@/components';
import { gettext } from '@/constants';
import { agentAPI } from '@/project/api';
import AIReply from '@/project/components/ai-reply';
import ProcessDetails from '@/project/components/thought-process/process-details';
import {
  formatDetailsJSONValue,
  shouldHighlightDetailsAsJSON,
} from './utils';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const PRIMARY_SECTION = {
  key: 'action_steps',
  icon: 'action-steps',
  isPrimaryContainer: true,
};
const PHASE_ORDER = ['prelude', 'analysis', 'handling', 'regeneration'];
const PHASE_LABELS = {
  prelude: gettext('Prelude'),
  analysis: gettext('Analysis'),
  handling: gettext('Handling'),
  regeneration: gettext('Regeneration'),
};

const getActionTitle = (action, index) => {
  const actionName = action?.tool_name || action?.type || '-';
  return `${gettext('Step')} ${index + 1}: ${actionName}`;
};

const MarkdownValueFormatter = ({ className, value }) => (
  <CustomizeMarkdownViewer className={className} value={String(value)} showTOC={false} />
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

const hasArguments = (value) => {
  if (!hasDetailValue(value)) return false;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value !== 'string') return true;
  try {
    const parsedValue = JSON.parse(value);
    if (!parsedValue || typeof parsedValue !== 'object') return true;
    return Object.keys(parsedValue).length > 0;
  } catch (e) {
    return true;
  }
};

const buildPhaseDetailNode = (phase, field, label, formatter) => {
  if (!hasDetailValue(phase?.[field])) return null;
  return {
    id: `phase-${field}`,
    name: label,
    children: [
      {
        value: shouldHighlightDetailsAsJSON(field) ? formatDetailsJSONValue(phase[field]) : phase[field],
        formatter,
      }
    ],
  };
};

const buildDetailsChildren = (details) => {
  if (!details || typeof details !== 'object') return [];

  const isSkillView = details.tool_name === 'skill_view';
  const children = [];
  if (hasArguments(details.tool_arguments)) {
    children.push({
      name: `• ${gettext('Arguments')}`,
      value: formatDetailsJSONValue(details.tool_arguments),
      formatter: JSONDetailValueFormatter,
    });
  }
  if (hasDetailValue(details.observation)) {
    children.push({
      name: `• ${gettext('Observation')}`,
      value: isSkillView ? String(details.observation) : formatDetailsJSONValue(details.observation),
      formatter: isSkillView ? MarkdownValueFormatter : JSONDetailValueFormatter,
    });
  }
  return children;
};

const buildActionDetailNode = (action, actionIndex) => {
  return {
    id: action.id || `action-${actionIndex}`,
    name: getActionTitle(action, actionIndex),
    children: buildDetailsChildren(action),
  };
};

const buildPhaseGroupedActionNodes = (run) => {
  const items = Array.isArray(run?.items) ? run.items : [];

  return items.flatMap((item, itemIndex) => PHASE_ORDER.map((phaseName) => {
    const phase = item?.actions?.[phaseName];
    if (!phase || typeof phase !== 'object') return null;

    const actions = Array.isArray(phase.actions) ? phase.actions : [];
    const promptNode = buildPhaseDetailNode(phase, 'prompt', gettext('Prompt'), MarkdownValueFormatter);
    const inputNode = buildPhaseDetailNode(phase, 'input', gettext('Input'), JSONDetailValueFormatter);
    const resultNode = buildPhaseDetailNode(phase, 'result', gettext('Result'), JSONDetailValueFormatter);
    const actionNodes = actions.map(buildActionDetailNode);
    const actionsNode = actionNodes.length > 0 ? {
      id: `item-${itemIndex}-phase-${phaseName}-actions`,
      name: gettext('Actions'),
      children: actionNodes,
    } : null;

    if (!promptNode && !inputNode && !resultNode && !actionsNode) return null;
    return {
      id: `item-${itemIndex}-phase-${phaseName}`,
      name: PHASE_LABELS[phaseName],
      children: [promptNode, inputNode, actionsNode, resultNode].filter(Boolean),
    };
  }).filter(Boolean));
};

const buildThoughtProcessTree = (run) => {
  const phaseNodes = buildPhaseGroupedActionNodes(run);
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

    agentAPI.getAgentRunDetails(projectUuid, runId).then((res) => {
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
