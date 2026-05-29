import React, { useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';
import { Modal, ModalBody, Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap';
import { CenteredLoading, Icon, IconButton, ModalHeader } from '@/components';
import { gettext } from '@/constants';
import AIReply from '@/project/components/ai-reply';
import { agentAPI } from '@/project/api';
import {
  formatDetailsJSONValue,
  formatDetailsValue,
  shouldHighlightDetailsAsJSON,
} from './tool-details-content';

import './thought-process-dialog.css';

const { projectUuid } = window.app.pageOptions;

const PHASE_ORDER = ['prelude', 'analysis', 'handling'];
const SECTION_ICONS = {
  system_prompt: 'task-step',
  actions: 'action-steps',
  result: 'answer-generation',
  suggestions: 'suggestion',
};

const ACTION_TYPE_SUMMARY = 'summary';
const ACTION_TYPE_SUGGESTION = 'suggestion';

const hasValue = (value) => value !== undefined && value !== null && value !== '';

const toPhaseLabel = (phase) => {
  if (!phase) return '';
  return phase.charAt(0).toUpperCase() + phase.slice(1);
};

const getActionStatusSuffix = (action) => {
  if (action?.forced_tool_call && action?.is_max_step) {
    return gettext('forced by reaching max steps');
  }
  if (action?.forced_tool_call) {
    return gettext('forced');
  }
  if (action?.is_max_step) {
    return gettext('Reach max steps');
  }
  return '';
};

const getActionTitle = (action, index) => {
  const actionName = action?.tool_name || action?.type || '-';
  const step = Number.isInteger(action?.step) ? action.step + 1 : index + 1;
  const suffix = getActionStatusSuffix(action);
  return `${gettext('Action')} ${step}: ${actionName}${suffix ? ` (${suffix})` : ''}`;
};

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

const getValidPhase = (action) => {
  const phase = action?.phase;
  if (typeof phase !== 'string') return null;
  const normalizedPhase = phase.toLowerCase();
  return PHASE_ORDER.includes(normalizedPhase) ? normalizedPhase : null;
};

const collectRunActions = (run) => {
  const { items = [], actions = [] } = run || {};
  const itemActions = items.flatMap((item) => item.actions || []);
  return [...itemActions, ...actions];
};

const getFirstPrompt = (actions = []) => {
  const promptAction = actions.find((action) => hasValue(action?.prompt));
  return promptAction?.prompt || '';
};

const buildPhaseTabs = (run) => {
  const actions = collectRunActions(run);
  const actionsByPhase = PHASE_ORDER.reduce((acc, phase) => {
    acc[phase] = [];
    return acc;
  }, {});

  actions.forEach((action) => {
    const phase = getValidPhase(action);
    if (!phase) return;
    actionsByPhase[phase].push(action);
  });

  return PHASE_ORDER.map((phase) => {
    const phaseActions = actionsByPhase[phase];
    if (phaseActions.length === 0) return null;

    const results = phase === 'handling'
      ? phaseActions.filter((action) => action?.type === ACTION_TYPE_SUMMARY && hasValue(action?.result))
      : phaseActions.filter((action) => hasValue(action?.result));
    const suggestions = phase === 'handling'
      ? phaseActions.filter((action) => action?.type === ACTION_TYPE_SUGGESTION && (hasValue(action?.result) || hasValue(action?.suggestion_content)))
      : [];

    return {
      key: phase,
      label: toPhaseLabel(phase),
      systemPrompt: getFirstPrompt(phaseActions),
      actions: phaseActions,
      results,
      suggestions,
    };
  }).filter(Boolean);
};

const renderFormattedValue = (fieldKey, value) => {
  if (!hasValue(value)) return null;
  const formattedValue = shouldHighlightDetailsAsJSON(fieldKey) ? formatDetailsJSONValue(value) : formatDetailsValue(value);
  const Formatter = shouldHighlightDetailsAsJSON(fieldKey) ? JSONDetailValueFormatter : DetailValueFormatter;
  return <Formatter value={formattedValue} className="agent-thought-process-field-value" />;
};

const MarkdownValue = ({ value }) => {
  if (!hasValue(value)) return null;
  return (
    <AIReply
      className="agent-thought-process-markdown"
      message={{ ai_reply: formatDetailsValue(value) }}
      projectUuid={projectUuid}
      canPreviewLinkedFile={false}
    />
  );
};

const ListItem = ({ label, value, fieldKey, isMarkdown = false }) => {
  if (!hasValue(value)) return null;
  return (
    <li className="agent-thought-process-list-item">
      <div className="agent-thought-process-field-label">{label}</div>
      {isMarkdown ? <MarkdownValue value={value} /> : renderFormattedValue(fieldKey, value)}
    </li>
  );
};

const Section = ({ title, icon, children, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  if (!children) return null;

  return (
    <section className="agent-thought-process-section">
      <div
        className={classnames('seaqa-ai-thought-process-order', 'primary-order-container', { 'has-content': isExpanded })}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <span className="seaqa-ai-thought-process-order-title">
          <Icon symbol={icon} />
          <span>{title}</span>
        </span>
        <IconButton icon="arrow-down" className={classnames('no-hover-bg', { 'rotate-icon-180': isExpanded })} />
      </div>
      {isExpanded && (
        <div className="seaqa-ai-thought-process-content primary-content-container agent-thought-process-section-body">
          {children}
        </div>
      )}
    </section>
  );
};

const CollapsibleItem = ({ title, children, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className={classnames('agent-thought-process-collapsible-item', className)}>
      <div className="seaqa-ai-thought-process-order" onClick={() => setIsExpanded((prev) => !prev)}>
        <span className="seaqa-ai-thought-process-order-title">
          <span>{title}</span>
          <IconButton icon="arrow-down" className={classnames('no-hover-bg agent-thought-process-inline-toggle', { 'rotate-icon-180': isExpanded })} />
        </span>
      </div>
      {isExpanded && (
        <div className="seaqa-ai-thought-process-content agent-thought-process-item-content">
          {children}
        </div>
      )}
    </div>
  );
};

const ThoughtProcessDialog = ({ runId, onToggle }) => {
  const [run, setRun] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');

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

  const phaseTabs = useMemo(() => buildPhaseTabs(run), [run]);

  useEffect(() => {
    if (phaseTabs.length === 0) {
      setActiveTab('');
      return;
    }

    const hasActiveTab = phaseTabs.some((tab) => tab.key === activeTab);
    if (!hasActiveTab) {
      setActiveTab(phaseTabs[0].key);
    }
  }, [activeTab, phaseTabs]);

  return (
    <Modal isOpen={true} toggle={onToggle} className="seaqa-ai-thought-process-dialog agent-thought-process-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Thought process')}</ModalHeader>
      <ModalBody>
        {isLoading ? (
          <div className="agent-thought-process-loading">
            <CenteredLoading />
          </div>
        ) : phaseTabs.length === 0 ? (
          <div className="agent-thought-process-empty">{gettext('No thought process details')}</div>
        ) : (
          <div className="agent-thought-process-content">
            <Nav tabs className="agent-thought-process-tabs">
              {phaseTabs.map((tab) => (
                <NavItem key={tab.key}>
                  <NavLink
                    className={classnames({ active: activeTab === tab.key })}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </NavLink>
                </NavItem>
              ))}
            </Nav>

            <TabContent activeTab={activeTab} className="agent-thought-process-tab-content">
              {phaseTabs.map((tab) => (
                <TabPane tabId={tab.key} key={tab.key}>
                  <div className="agent-thought-process-tab-pane">
                    {hasValue(tab.systemPrompt) && (
                      <Section title={gettext('System prompt')} icon={SECTION_ICONS.system_prompt}>
                        <MarkdownValue value={tab.systemPrompt} />
                      </Section>
                    )}

                    {tab.actions.length > 0 && (
                      <Section title={gettext('Actions')} icon={SECTION_ICONS.actions}>
                        <div className="agent-thought-process-action-list seaqa-ai-thought-process-content">
                          {tab.actions.map((action, actionIndex) => (
                            <CollapsibleItem title={getActionTitle(action, actionIndex)} key={action.id || `${tab.key}-${actionIndex}`}>
                              <ul className="agent-thought-process-detail-list mb-0">
                                <ListItem label={gettext('Arguments')} value={action.tool_arguments} fieldKey="tool_arguments" />
                                <ListItem label={gettext('Observation')} value={action.observation} fieldKey="observation" />
                              </ul>
                            </CollapsibleItem>
                          ))}
                        </div>
                      </Section>
                    )}

                    {tab.results.length > 0 && (
                      <Section title={gettext('Result')} icon={SECTION_ICONS.result}>
                        <div className="agent-thought-process-result-list">
                          {tab.results.map((action, actionIndex) => (
                            <div className="agent-thought-process-result-card" key={action.id || `${tab.key}-result-${actionIndex}`}>
                              <MarkdownValue value={action.result} />
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {tab.key === 'handling' && tab.suggestions.length > 0 && (
                      <Section title={gettext('Suggestion')} icon={SECTION_ICONS.suggestions}>
                        <div className="agent-thought-process-suggestion-list seaqa-ai-thought-process-content">
                          {tab.suggestions.map((action, actionIndex) => (
                            <div className="agent-thought-process-suggestion-group" key={action.id || `${tab.key}-suggestion-${actionIndex}`}>
                              <CollapsibleItem title={gettext('Type')} className="agent-thought-process-suggestion-entry">
                                <MarkdownValue value={action.result} />
                              </CollapsibleItem>
                              <CollapsibleItem title={gettext('Content')} className="agent-thought-process-suggestion-entry">
                                <MarkdownValue value={action.suggestion_content} />
                              </CollapsibleItem>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}
                  </div>
                </TabPane>
              ))}
            </TabContent>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default ThoughtProcessDialog;
