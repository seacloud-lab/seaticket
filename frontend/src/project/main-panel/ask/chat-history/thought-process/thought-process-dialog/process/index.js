import { useState, useCallback } from 'react';
import { FormGroup, Label } from 'reactstrap';
import classnames from 'classnames';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import StepMarkdownViewer from '../markdown-viewer';

import './index.css';

const Process = ({ value }) => {
  const [isShowDetails, setIsShowDetails] = useState(false);

  const onShowDetailsToggle = useCallback(() => {
    setIsShowDetails(!isShowDetails);
  }, [isShowDetails]);

  return (
    <div className="sea-qa-ai-thought-process">
      <div className="sea-qa-ai-thought-process-order" onClick={onShowDetailsToggle}>
        <IconButton icon="down" className={classnames('no-hover-bg', { 'rotate-icon-270': !isShowDetails })} />
        <span className="sea-qa-ai-thought-process-order-title">
          {`${value.step_number}. ${value.tool_calls[0].function.name}`}
        </span>
      </div>
      {isShowDetails && (
        <div className="sea-qa-ai-thought-process-content">
          <FormGroup className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-1">
            <Label>{gettext('Arguments')}</Label>
            <div className="sea-qa-ai-thought-process-value">
              {value.tool_calls[0].function.arguments.query || (<span className="sea-qa-tip-default">{gettext('Empty')}</span>)}
            </div>
          </FormGroup>
          <FormGroup className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-1">
            <Label>{gettext('Model input messages')}</Label>
            {Array.isArray(value.model_input_messages) && value.model_input_messages.length > 0 ? (
              <>
                {value.model_input_messages.map((message, index) => {
                  return (
                    <FormGroup className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-2" key={index}>
                      <Label>{'No. ' + (index + 1)}</Label>
                      {/* role */}
                      <FormGroup className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-3">
                        <Label>{gettext('Role')}</Label>
                        <div className="sea-qa-ai-thought-process-value">
                          {message.role}
                        </div>
                      </FormGroup>
                      {/* content */}
                      <FormGroup className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-3">
                        <Label>{gettext('Content')}</Label>
                        <FormGroup className="sea-qa-ai-thought-process-key mb-0 sea-qa-ai-thought-process-key-level-4">
                          <Label>{gettext('Value')}</Label>
                          {(message.content && message.content[0]?.text) ? (
                            <StepMarkdownViewer value={message.content[0]?.text} className="sea-qa-ai-thought-process-value" />
                          ) : (
                            <div className="sea-qa-ai-thought-process-value">
                              <span className="sea-qa-tip-default">{gettext('Empty')}</span>
                            </div>
                          )}
                        </FormGroup>
                        <FormGroup className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-4">
                          <Label>{gettext('Type')}</Label>
                          <div className="sea-qa-ai-thought-process-value">
                            {message.content[0]?.type || (<span className="sea-qa-tip-default">{gettext('Empty')}</span>)}
                          </div>
                        </FormGroup>
                      </FormGroup>
                      {/* raw */}
                      <FormGroup className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-3">
                        <Label>{gettext('Raw')}</Label>
                        <div className="sea-qa-ai-thought-process-value">
                          {message.raw || (<span className="sea-qa-tip-default">{gettext('Empty')}</span>)}
                        </div>
                      </FormGroup>
                      {/* tool calls */}
                      <FormGroup className="sea-qa-ai-thought-process-key mb-0 sea-qa-ai-thought-process-key-level-3">
                        <Label>{gettext('Tool calls')}</Label>
                        <div className="sea-qa-ai-thought-process-value">
                          {message.tool_calls || (<span className="sea-qa-tip-default">{gettext('Empty')}</span>)}
                        </div>
                      </FormGroup>
                    </FormGroup>
                  );
                })}
              </>
            ) : (
              <div className="sea-qa-ai-thought-process-value">
                <span className="sea-qa-tip-default">{gettext('Empty')}</span>
              </div>
            )}
          </FormGroup>
          <FormGroup className="sea-qa-ai-thought-process-key sea-qa-ai-thought-process-key-level-1">
            <Label>{gettext('Observations')}</Label>
            {value.observations ? (
              <StepMarkdownViewer value={value.observations} className="sea-qa-ai-thought-process-value" />
            ) : (
              <div className="sea-qa-ai-thought-process-value">
                <span className="sea-qa-tip-default">{gettext('Empty')}</span>
              </div>
            )}
          </FormGroup>
        </div>
      )}
    </div>
  );
};

export default Process;
