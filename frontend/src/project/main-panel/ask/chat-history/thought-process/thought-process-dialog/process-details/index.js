import { useState, useCallback } from 'react';
import { FormGroup, Label } from 'reactstrap';
import classnames from 'classnames';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import StepMarkdownViewer from '../markdown-viewer';

import './index.css';

const ProcessDetails = ({ value }) => {
  const [expandedStates, setExpandedStates] = useState({
    planStep: false,
    systemPrompts: false,
    userMessage: false,
    actionSteps: false,
    finalAnswer: false,
    arguments: [],
    observations: []
  });

  const toggleExpand = useCallback((section, index = null) => {
    setExpandedStates(prev => {
      const newState = { ...prev };

      if (index !== null) {
        const key = `${section}${index}`;
        newState[key] = !newState[key];
      } else {
        newState[section] = !newState[section];

        if (section === 'actionSteps' && newState.actionSteps) {
          newState.arguments = [true];
        }
      }

      return newState;
    });
  }, []);

  // for final answer
  const finalAnswerStep = value.find(step =>
    step.is_final_answer || step.error?.type === 'AgentMaxStepsError'
  );

  return (
    <div className="sea-qa-ai-thought-process">
      {/* Plan step */}
      <div
        className="sea-qa-ai-thought-process-order"
        onClick={() => toggleExpand('planStep')}
      >
        <IconButton
          icon={expandedStates.planStep ? 'up' : 'down'}
          className={classnames('no-hover-bg', { 'rotate-icon-270': !expandedStates.planStep })}
        />
        <span className="sea-qa-ai-thought-process-order-title">
          {gettext('Plan step')}
        </span>
      </div>

      {expandedStates.planStep && (
        <div className="sea-qa-ai-thought-process-content">
          <div
            className="sea-qa-ai-thought-process-order"
            onClick={() => toggleExpand('systemPrompts')}
          >
            <IconButton
              icon={expandedStates.systemPrompts ? 'up' : 'down'}
              className={classnames('no-hover-bg', { 'rotate-icon-270': !expandedStates.systemPrompts })}
            />
            <span className="sea-qa-ai-thought-process-order-title">
              {gettext('System prompts')}
            </span>
          </div>
          {expandedStates.systemPrompts && (
            <div className="sea-qa-ai-thought-process-content">
              <FormGroup className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-1">
                <div className="sea-qa-ai-thought-process-value">
                  {value[0]?.model_input_messages?.[0]?.content?.[0]?.text || (
                    <span className="sea-qa-tip-default">{gettext('Empty')}</span>
                  )}
                </div>
              </FormGroup>
            </div>
          )}

          <div
            className="sea-qa-ai-thought-process-order"
            onClick={() => toggleExpand('userMessage')}
          >
            <IconButton
              icon={expandedStates.userMessage ? 'up' : 'down'}
              className={classnames('no-hover-bg', { 'rotate-icon-270': !expandedStates.userMessage })}
            />
            <span className="sea-qa-ai-thought-process-order-title">
              {gettext('User message')}
            </span>
          </div>

          {expandedStates.userMessage && (
            <div className="sea-qa-ai-thought-process-content">
              <FormGroup className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-1">
                <div className="sea-qa-ai-thought-process-value">
                  {value[0]?.model_input_messages?.[1]?.content?.[0]?.text.substring(10) || (
                    <span className="sea-qa-tip-default">{gettext('Empty')}</span>
                  )}
                </div>
              </FormGroup>
            </div>
          )}
        </div>
      )}

      {/* Action steps */}
      <div
        className="sea-qa-ai-thought-process-order"
        onClick={() => toggleExpand('actionSteps')}
      >
        <IconButton
          icon={expandedStates.actionSteps ? 'up' : 'down'}
          className={classnames('no-hover-bg', { 'rotate-icon-270': !expandedStates.actionSteps })}
        />
        <span className="sea-qa-ai-thought-process-order-title">
          {gettext('Action steps')}
        </span>
      </div>

      {expandedStates.actionSteps && (
        <div className="sea-qa-ai-thought-process-content">
          {value.map((step, index) =>
            !step.is_final_answer && step.tool_calls.length > 0 && (
              <div key={index} className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-1">
                <div
                  className="sea-qa-ai-thought-process-order"
                  onClick={() => toggleExpand('actionSteps', index)}
                >
                  <IconButton
                    icon={expandedStates[`actionSteps${index}`] ? 'up' : 'down'}
                    className={classnames('no-hover-bg', { 'rotate-icon-270': !expandedStates[`actionSteps${index}`] })}
                  />
                  <span className="sea-qa-ai-thought-process-order-title">
                    {`${gettext('Step')} ${step.step_number}: ${step.tool_calls?.[0]?.function?.name}`}
                  </span>
                </div>

                {expandedStates[`actionSteps${index}`] && (
                  <div className="sea-qa-ai-thought-process-content">
                    {/* Arguments Section */}
                    <div>
                      <div
                        className="sea-qa-ai-thought-process-order"
                        onClick={() => toggleExpand('arguments', index)}
                      >
                        <IconButton
                          icon={expandedStates[`arguments${index}`] ? 'up' : 'down'}
                          className={classnames('no-hover-bg', { 'rotate-icon-270': !expandedStates[`arguments${index}`] })}
                        />
                        <span className="sea-qa-ai-thought-process-order-title">
                          {gettext('Arguments')}
                        </span>
                      </div>

                      {expandedStates[`arguments${index}`] && (
                        <div className="sea-qa-ai-thought-process-content">
                          {Object.entries(step.tool_calls?.[0]?.function?.arguments || {}).map(([key, val], argIndex) => (
                            <FormGroup
                              key={argIndex}
                              className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2"
                            >
                              <Label>{`${gettext('Argument')} ${argIndex + 1}: ${key}`}</Label>
                              <div className="sea-qa-ai-thought-process-value">
                                {val || (
                                  <span className="sea-qa-tip-default">{gettext('Empty')}</span>
                                )}
                              </div>
                            </FormGroup>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Observations Section */}
                    {step.error ?
                      <div>
                        <div
                          className="sea-qa-ai-thought-process-order"
                          onClick={() => toggleExpand('observations', index)}
                        >
                          <IconButton
                            icon={expandedStates[`observations${index}`] ? 'up' : 'down'}
                            className={classnames('no-hover-bg', { 'rotate-icon-270': !expandedStates[`observations${index}`] })}
                          />
                          <span className="sea-qa-ai-thought-process-order-title">
                            {gettext('Error')}
                          </span>
                        </div>

                        {expandedStates[`observations${index}`] && (
                          <>
                            <div className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2">
                              <Label>{gettext('Error type')}</Label>
                              <div className="sea-qa-ai-thought-process-value">
                                {step.error.type || gettext('Empty')}
                              </div>
                            </div>
                            <div className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2">
                              <Label>{gettext('Error message')}</Label>
                              <div className="sea-qa-ai-thought-process-value">
                                {step.error.message || gettext('Empty')}
                              </div>
                            </div>
                            <div className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2">
                              <Label>{gettext('Step output')}</Label>
                              <div className="sea-qa-ai-thought-process-value">
                                {step.action_output ? (
                                  <StepMarkdownViewer value={JSON.stringify(step.action_output)} className="sea-qa-ai-thought-process-value" />
                                ) : (
                                  <span className="sea-qa-tip-default">{gettext('Empty')}</span>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div> :
                      <div>
                        <div
                          className="sea-qa-ai-thought-process-order"
                          onClick={() => toggleExpand('observations', index)}
                        >
                          <IconButton
                            icon={expandedStates[`observations${index}`] ? 'up' : 'down'}
                            className={classnames('no-hover-bg', { 'rotate-icon-270': !expandedStates[`observations${index}`] })}
                          />
                          <span className="sea-qa-ai-thought-process-order-title">
                            {gettext('Observation')}
                          </span>
                        </div>

                        {expandedStates[`observations${index}`] && (
                          <FormGroup className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2">
                            <div className="sea-qa-ai-thought-process-value">
                              {step.observations ? (
                                <StepMarkdownViewer value={step.observations} className="sea-qa-ai-thought-process-value" />
                              ) : (
                                <span className="sea-qa-tip-default">{gettext('Empty')}</span>
                              )}
                            </div>
                          </FormGroup>
                        )}
                      </div>}

                    {/* Other information Section */}
                    <div>
                      <div
                        className="sea-qa-ai-thought-process-order"
                        onClick={() => toggleExpand('otherInfo', index)}
                      >
                        <IconButton
                          icon={expandedStates[`otherInfo${index}`] ? 'up' : 'down'}
                          className={classnames('no-hover-bg', { 'rotate-icon-270': !expandedStates[`otherInfo${index}`] })}
                        />
                        <span className="sea-qa-ai-thought-process-order-title">
                          {gettext('Other information')}
                        </span>
                      </div>

                      {expandedStates[`otherInfo${index}`] && (
                        <div className="sea-qa-ai-thought-process-content">
                          <div className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2">
                            <Label>{gettext('Input tokens')}</Label>
                            <div className="sea-qa-ai-thought-process-value">
                              {step.token_usage?.input_tokens || 0}
                            </div>
                          </div>
                          <div className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2">
                            <Label>{gettext('Output tokens')}</Label>
                            <div className="sea-qa-ai-thought-process-value">
                              {step.token_usage?.output_tokens || 0}
                            </div>
                          </div>
                          <div className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2">
                            <Label>{gettext('Total tokens')}</Label>
                            <div className="sea-qa-ai-thought-process-value">
                              {step.token_usage?.total_tokens || 0}
                            </div>
                          </div>
                          <div className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2">
                            <Label>{gettext('Time usage')}</Label>
                            <div className="sea-qa-ai-thought-process-value">
                              {`${step.timing?.duration || 0} s`}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* Final answer */}
      {finalAnswerStep && (
        <>
          <div
            className="sea-qa-ai-thought-process-order"
            onClick={() => toggleExpand('finalAnswer')}
          >
            <IconButton
              icon={expandedStates.finalAnswer ? 'up' : 'down'}
              className={classnames('no-hover-bg', { 'rotate-icon-270': !expandedStates.finalAnswer })}
            />
            <span className="sea-qa-ai-thought-process-order-title">
              {gettext('Final answer')}
            </span>
          </div>

          {expandedStates.finalAnswer && (
            <div className="sea-qa-ai-thought-process-content">
              <div
                className="sea-qa-ai-thought-process-order"
                onClick={() => toggleExpand('finalAnswerObservations')}
              >
                <IconButton
                  icon={expandedStates.finalAnswerObservations ? 'up' : 'down'}
                  className={classnames('no-hover-bg', { 'rotate-icon-270': !expandedStates.finalAnswerObservations })}
                />
                <span className="sea-qa-ai-thought-process-order-title">
                  {finalAnswerStep.error?.type === 'AgentMaxStepsError' ? gettext('Result_reached_max_steps') : gettext('Result')}
                </span>
              </div>
              {expandedStates.finalAnswerObservations && (
                <div className="sea-qa-ai-thought-process-value">
                  {finalAnswerStep.observations || finalAnswerStep.action_output ? (
                    <StepMarkdownViewer value={finalAnswerStep.observations || JSON.stringify(finalAnswerStep.action_output)} className="sea-qa-ai-thought-process-value" />
                  ) : (
                    <span className="sea-qa-tip-default">{gettext('Empty')}</span>
                  )}
                </div>
              )}

              <div
                className="sea-qa-ai-thought-process-order"
                onClick={() => toggleExpand('finalAnswerOtherInfo')}
              >
                <IconButton
                  icon={expandedStates.finalAnswerOtherInfo ? 'up' : 'down'}
                  className={classnames('no-hover-bg', { 'rotate-icon-270': !expandedStates.finalAnswerOtherInfo })}
                />
                <span className="sea-qa-ai-thought-process-order-title">
                  {gettext('Other information')}
                </span>
              </div>
              {expandedStates.finalAnswerOtherInfo && (
                <div className="sea-qa-ai-thought-process-content">
                  <div className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2">
                    <Label>{gettext('Input tokens')}</Label>
                    <div className="sea-qa-ai-thought-process-value">
                      {finalAnswerStep.token_usage?.input_tokens || 0}
                    </div>
                  </div>
                  <div className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2">
                    <Label>{gettext('Output tokens')}</Label>
                    <div className="sea-qa-ai-thought-process-value">
                      {finalAnswerStep.token_usage?.output_tokens || 0}
                    </div>
                  </div>
                  <div className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2">
                    <Label>{gettext('Total tokens')}</Label>
                    <div className="sea-qa-ai-thought-process-value">
                      {finalAnswerStep.token_usage?.total_tokens || 0}
                    </div>
                  </div>
                  <div className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2">
                    <Label>{gettext('Time usage')}</Label>
                    <div className="sea-qa-ai-thought-process-value">
                      {`${finalAnswerStep.timing?.duration || 0} s`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProcessDetails;
