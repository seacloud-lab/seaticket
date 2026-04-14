import { useEffect, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { ModalHeader } from '@/components';
import { gettext } from '@/constants';
import ProcessDetails from './process-details';
import { isObject } from '@/utils/type-detection';
import { formatWithTimezone, getDateDisplayString } from '@/sea-metadata/utils/column';
import { Attachments } from '../../../components';
import CustomizeMarkdownViewer from '../../customize-markdown-viewer';
import { CHAT_MESSAGE_TYPE } from '../../../constants';
import { hasOwnProperty } from '@/utils/object-utils';

import './index.css';

const getCompletionRetryChildren = (retries = []) => {
  return retries
    .filter(retry => retry?.reason)
    .map((retry, index) => ({
      name: `${gettext('Retry')} ${index + 1}`,
      value: retry.error,
    }));
};

const getToolRetryChildren = (retries = []) => {
  return retries
    .filter(Boolean)
    .map((error, index) => ({
      name: `${gettext('Retry')} ${index + 1}`,
      value: error,
    }));
};

const generatorUserMessage = (name, messageInfo = {}, props) => {
  const { attachments, message, raw } = messageInfo || {};

  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  if (!hasAttachments) {
    return {
      name,
      children: [
        {
          value: message ? { [CHAT_MESSAGE_TYPE.AI_REPLY]: message } : null,
          formatter: ({ className, value }) => (<CustomizeMarkdownViewer message={value} className={className} { ...props } />),
        }
      ]
    };
  }

  let userMessage = {
    name,
    children: [
      {
        name: gettext('Message'),
        children: [
          {
            value: message ? { [CHAT_MESSAGE_TYPE.AI_REPLY]: message } : null,
            formatter: ({ className, value }) => (<CustomizeMarkdownViewer message={value} className={className} { ...props } />),
          },
        ]
      }, {
        name: gettext('Attachments'),
        children: [
          {
            value: !Array.isArray(attachments) || attachments.length === 0 ? null : attachments,
            formatter: () => ( <Attachments attachments={attachments} className="mb-0 justify-content-start" projectUuid={props.projectUuid} />),
          },
        ]
      },
    ],
  };
  if (raw) {
    userMessage.rawChildren = [
      {
        value: raw ? { [CHAT_MESSAGE_TYPE.AI_REPLY]: raw } : null,
        formatter: ({ className, value }) => (<CustomizeMarkdownViewer message={value} className={className} { ...props } />),
      }
    ];
  }
  return userMessage;
};

const ThoughtProcessDialog = ({ value: propsValue, onToggle, projectUuid, ...props }) => {
  const [isLoading, setLoading] = useState(true);
  const [value, setValue] = useState([]);

  useEffect(() => {
    let value = [];
    const customizeMDProps = { ...props, projectUuid, canPreviewLinkedFile: false, chatId: 'thought-process' };

    // task
    if (hasOwnProperty(propsValue, 'task') && propsValue.task) {
      const { system_prompt, user_input } = propsValue.task || {};

      value.push({
        name: gettext('Task step'),
        children: [
          {
            name: gettext('System prompt'),
            children: [
              {
                value: system_prompt ? { [CHAT_MESSAGE_TYPE.AI_REPLY]: system_prompt } : null,
                formatter: ({ className, value }) => (<CustomizeMarkdownViewer message={value} className={className} { ...customizeMDProps } />),
              }
            ]
          },
          generatorUserMessage(gettext('User input'), user_input, customizeMDProps),
        ]
      });
    }

    // context
    if (hasOwnProperty(propsValue, 'context') && Array.isArray(propsValue?.context) && propsValue?.context.length > 0) {
      const contextValue = propsValue?.context;
      value.push({
        name: gettext('Context'),
        children: contextValue.map(record => {
          return {
            name: (
              <>
                {gettext('Date')}
                {': '}
                <span title={formatWithTimezone(record.date)}>
                  {getDateDisplayString(record.date, 'YYYY-MM-DD HH:mm:ss')}
                </span>
              </>
            ),
            children: [
              generatorUserMessage(gettext('User message'), record.user_input, customizeMDProps),
              {
                name: gettext('Assistant response'),
                children: record.assistant_response.length <= 1 ? [
                  {
                    name: gettext('Answer'),
                    children: [
                      {
                        value: {
                          [CHAT_MESSAGE_TYPE.AI_REPLY]: record.assistant_response?.[0]?.content?.answer,
                          [CHAT_MESSAGE_TYPE.SOURCES]: Array.isArray(record.assistant_response?.[0]?.content?.sources) ? record.assistant_response?.[0]?.content?.sources : [],
                        },
                        formatter: ({ className, value }) => (<CustomizeMarkdownViewer message={value} className={className} { ...customizeMDProps } />),
                      }
                    ]
                  }
                ] : Object.entries(record.assistant_response).map(([responseDate, responseContent], responseIndex) => {
                  return {
                    name: (
                      <>
                        {`${gettext('Response')} ${responseIndex + 1}: `}
                        {`(${gettext('Date')}: `}
                        <span title={formatWithTimezone(responseDate)}>
                          {getDateDisplayString(responseDate, 'YYYY-MM-DD HH:mm:ss')}
                        </span>
                        {')'}
                      </>
                    ),
                    children: [
                      { value: responseContent }
                    ]
                  };
                })
              }
            ]
          };
        }),
      });
    }

    // action
    if (Array.isArray(propsValue.actions) && propsValue.actions.length > 0) {
      value.push({
        name: gettext('Action steps'),
        children: propsValue.actions.map((action, stepNumber) => {
          let otherInfos = [
            action.error ? {
              name: gettext('Error'),
              children: [
                { name: gettext('Error type'), value: action.error.type },
                { name: gettext('Error message'), value: action.error.message },
                {
                  name: gettext('Step output'),
                  value: action.result ? { [CHAT_MESSAGE_TYPE.AI_REPLY]: action.result } : null,
                  formatter: ({ className, value }) => (<CustomizeMarkdownViewer message={value} className={className} { ...customizeMDProps } />),
                },
              ]
            } : {
              name: gettext('Observation'),
              children: [
                {
                  value: action.result ? { [CHAT_MESSAGE_TYPE.AI_REPLY]: action.result } : null,
                  formatter: ({ className, value }) => (<CustomizeMarkdownViewer message={value} className={className} { ...customizeMDProps } />),
                }
              ]
            }
          ];
          const completionRetryChildren = getCompletionRetryChildren(action.completion_retry);
          if (completionRetryChildren.length > 0) {
            otherInfos.push({
              name: gettext('Completion retry'),
              children: completionRetryChildren,
            });
          }
          const toolRetryChildren = getToolRetryChildren(action.tool_retry);
          if (toolRetryChildren.length > 0) {
            otherInfos.push({
              name: gettext('Tool retry'),
              children: toolRetryChildren,
            });
          }
          if (action.token_usage || action.time_usage) {
            let staticValue = [];
            if (action.time_usage) {
              staticValue.push(`${gettext('Time usage')}: ${action.time_usage?.toFixed(2) || 0} s`);
            }
            if (action.token_usage) {
              staticValue.push(`${gettext('Token usage')}: ${action.token_usage.total_tokens} (↑${action.token_usage.total_tokens}, ↓${action.token_usage.output_tokens})`);
            }
            otherInfos.push({
              name: gettext('Statistics'),
              children: staticValue
            });
          }
          const tool_calls = action.tool_calls;
          if (tool_calls?.length === 1) {
            let executionInfo = [{
              name: gettext('Arguments'),
              children: tool_calls?.[0].name === 'generate_markdown' || tool_calls?.[0].name === 'create_knowledge_base_entry' ? [
                {
                  name: gettext('File name'),
                  value: tool_calls?.[0]?.arguments.file_name,
                }, {
                  name: gettext('Content'),
                  children: [
                    {
                      value: tool_calls?.[0]?.arguments.content ? { [CHAT_MESSAGE_TYPE.AI_REPLY]: tool_calls?.[0]?.arguments.content } : null,
                      formatter: ({ className, value }) => (<CustomizeMarkdownViewer message={value} className={className} { ...customizeMDProps } />),
                    }
                  ]
                },
              ] : Object.entries(tool_calls?.[0]?.arguments || {}).map(([argumentKey, argumentValue]) => {
                return `${argumentKey}: ${argumentValue}`;
              })
            }];
            if (tool_calls?.[0]?.execution_detail) {
              executionInfo.push({
                name: gettext('Execution detail'),
                children: Object.entries(tool_calls?.[0]?.execution_detail || {}).map(([detailKey, detailValue]) => {
                  return `${gettext(detailKey)}: ${detailValue}`;
                })
              });
            }
            return {
              name: `${gettext('Step')} ${stepNumber + 1}: ${tool_calls?.[0].name}`,
              children: [...executionInfo, ...otherInfos],
            };
          }
          let stepChildren = [];
          if (action.tool_calls.length > 1){
            stepChildren.push({
              name: gettext('Substep'),
              children: action.tool_calls.map((too_call, toolIndex) => {
                let SubstepExecutionInfo = [{
                  name: gettext('Arguments'),
                  children: too_call.name === 'generate_markdown' || too_call.name === 'create_knowledge_base_entry' ? [
                    {
                      name: gettext('File name'),
                      value: too_call.arguments.file_name,
                    }, {
                      name: gettext('Content'),
                      children: [
                        {
                          value: too_call.arguments.content ? { [CHAT_MESSAGE_TYPE.AI_REPLY]: tool_calls?.[0]?.arguments.content } : null,
                          formatter: ({ className, value }) => (<CustomizeMarkdownViewer message={value} className={className} { ...customizeMDProps } />),
                        }
                      ]
                    },
                  ] : Object.entries(too_call.arguments || {}).map(([argumentKey, argumentValue]) => {
                    return `${argumentKey}: ${argumentValue}`;
                  })
                }];
                if (too_call.execution_detail) {
                  SubstepExecutionInfo.push({
                    name: gettext('Execution detail'),
                    children: Object.entries(too_call.execution_detail || {}).map(([detailKey, detailValue]) => {
                      return `${gettext(detailKey)}: ${detailValue}`;
                    })
                  });
                }
                return {
                  name: `${gettext('Substep')} ${toolIndex + 1}: ${too_call.name}`,
                  children: SubstepExecutionInfo
                };
              })
            });
          }
          stepChildren = [...stepChildren, ...otherInfos];
          return {
            name: `${gettext('Step')} ${stepNumber + 1}`,
            children: stepChildren
          };
        })
      });
    }

    // final answer
    const final_answer = propsValue?.final_answer;
    const finalAnswerRetryChildren = getCompletionRetryChildren(final_answer?.retry);
    if (final_answer && (final_answer.result || finalAnswerRetryChildren.length > 0)){
      let result = final_answer.result;
      if (result && isObject(result)) {
        result = JSON.stringify(result);
      }
      let finalAnswerValue = [];
      if (result) {
        finalAnswerValue.push({
          name: final_answer.reach_max_steps ? gettext('Result_reached_max_steps') : gettext('Result'),
          children: [
            {
              value: result ? { [CHAT_MESSAGE_TYPE.AI_REPLY]: result } : null,
              formatter: ({ className, value }) => (<CustomizeMarkdownViewer message={value} className={className} { ...customizeMDProps } />),
            }
          ]
        });
      }
      if (finalAnswerRetryChildren.length > 0) {
        finalAnswerValue.push({
          name: gettext('Retry'),
          children: finalAnswerRetryChildren,
        });
      }
      if (final_answer.token_usage || final_answer.time_usage) {
        let staticValue = [];
        if (final_answer.time_usage) {
          staticValue.push(`${gettext('Time usage')}: ${final_answer.time_usage?.toFixed(2) || 0 } s`);
        }
        if (final_answer.token_usage) {
          staticValue.push(`${gettext('Token usage')}: ${final_answer.token_usage.total_tokens || 0} (↑${final_answer.token_usage.input_tokens || 0}, ↓${final_answer.token_usage.output_tokens || 0})`);
        }
        finalAnswerValue.push({
          name: gettext('Statistics'),
          children: staticValue
        });
      }
      value.push({
        name: gettext('Answer generation'),
        children: finalAnswerValue
      });
    }

    // statistics
    const statistics = propsValue?.static;
    if (statistics && (statistics.token_usage || statistics.time_usage)) {
      const { token_usage, time_usage } = statistics;
      let staticValue = [];
      if (time_usage) {
        staticValue.push(`${gettext('Time usage')}: ${time_usage.total?.toFixed(2) || 0 } s (${gettext('Action steps')}: ${time_usage.action_steps?.toFixed(2) || 0 } s, ${gettext('Answer generation')}: ${time_usage.answer_generation?.toFixed(2) || 0 } s)`);
      }
      if (token_usage) {
        staticValue.push({
          name: `${gettext('Token usages')}: ${token_usage.total_tokens?.total || 0} (↑${token_usage.input_tokens?.total || 0}, ↓${token_usage.output_tokens?.total || 0})`,
          children: [
            `${gettext('Action steps')}: ${token_usage.total_tokens?.action_steps || 0} (↑${token_usage.input_tokens?.action_steps || 0}, ↓${token_usage.output_tokens?.action_steps || 0})`,
            `${gettext('Answer generation')}: ${final_answer.token_usage.total_tokens || 0} (↑${final_answer.token_usage.input_tokens || 0}, ↓${final_answer.token_usage.output_tokens || 0})`
          ]
        });
      }
      value.push({
        name: gettext('Statistics'),
        children: staticValue
      });
    }

    setValue(value);
    setLoading(false);
  }, [propsValue]);

  return (
    <Modal isOpen={true} toggle={onToggle} className="sea-qa-ai-thought-process-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Thought process')}</ModalHeader>
      <ModalBody>
        {!isLoading && (
          <div className="sea-qa-ai-thought-process">
            {value.map((v, index) => {
              return (<ProcessDetails value={v} key={index} />);
            })}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default ThoughtProcessDialog;
