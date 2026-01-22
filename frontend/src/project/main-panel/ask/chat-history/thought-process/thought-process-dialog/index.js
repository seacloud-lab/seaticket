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

import './index.css';

const ThoughtProcessDialog = ({ value: propsValue, projectUuid, projectName, workspaceID, settings, onToggle }) => {
  const [isLoading, setLoading] = useState(true);
  const [value, setValue] = useState([]);

  useEffect(() => {
    let value = [];

    // task
    const taskValue = propsValue?.task;
    if (taskValue) {
      value.push({
        name: gettext('Task step'),
        children: [
          {
            name: gettext('System prompts'),
            children: [
              {
                value: taskValue.system_prompt,
                formatter: ({ className, value }) => (
                  <CustomizeMarkdownViewer
                    chatId="thought-process"
                    message={{ [CHAT_MESSAGE_TYPE.AI_REPLY]: value }}
                    settings={settings}
                    projectUuid={projectUuid}
                    projectName={projectName}
                    workspaceID={workspaceID}
                    className={className}
                    canPreviewLinkedFile={false}
                  />
                ),
              }
            ]
          }, {
            name: gettext('User input'),
            children: [
              {
                name: gettext('Attachments'),
                children: [
                  {
                    value: !Array.isArray(taskValue.user_input.attachments) || taskValue.user_input.attachments.length === 0 ? null : taskValue.user_input.attachments,
                    formatter: () => (
                      <Attachments
                        attachments={taskValue.user_input.attachments}
                        className="mb-0 justify-content-start"
                        projectUuid={projectUuid}
                      />
                    ),
                  },
                ]
              },
              {
                name: gettext('Message'),
                children: [
                  {
                    value: taskValue.user_input.message,
                    formatter: ({ className, value }) => (
                      <CustomizeMarkdownViewer
                        chatId="thought-process"
                        message={{ [CHAT_MESSAGE_TYPE.AI_REPLY]: value }}
                        settings={settings}
                        projectUuid={projectUuid}
                        projectName={projectName}
                        workspaceID={workspaceID}
                        className={className}
                        canPreviewLinkedFile={false}
                      />
                    ),
                  },
                ]
              }
            ]
          }
        ]
      });
    }

    // context
    const contextValue = propsValue?.context;
    if (Array.isArray(contextValue) && contextValue.length > 0) {
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
              {
                name: gettext('User message'),
                children: [
                  { value: record.user_input }
                ],
              }, {
                name: gettext('Assistant response'),
                children: record.assistant_response.length <= 1 ? [
                  {
                    name: gettext('Answer'),
                    children: [
                      {
                        value: {
                          [CHAT_MESSAGE_TYPE.AI_REPLY]: record.assistant_response?.[0]?.content?.answer,
                          [CHAT_MESSAGE_TYPE.SOURCES]: record.assistant_response?.[0]?.content?.references,
                        },
                        formatter: ({ className, value }) => (
                          <CustomizeMarkdownViewer
                            chatId="thought-process"
                            message={{ [CHAT_MESSAGE_TYPE.AI_REPLY]: value }}
                            settings={settings}
                            projectUuid={projectUuid}
                            projectName={projectName}
                            workspaceID={workspaceID}
                            className={className}
                            canPreviewLinkedFile={false}
                          />
                        ),
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
                  value: action.result,
                  formatter: ({ className, value }) => (
                    <CustomizeMarkdownViewer
                      chatId="thought-process"
                      message={{ [CHAT_MESSAGE_TYPE.AI_REPLY]: value }}
                      settings={settings}
                      projectUuid={projectUuid}
                      projectName={projectName}
                      workspaceID={workspaceID}
                      className={className}
                      canPreviewLinkedFile={false}
                    />
                  ),
                },
              ]
            } : {
              name: gettext('Observation'),
              children: [
                {
                  value: action.result,
                  formatter: ({ className, value }) => (
                    <CustomizeMarkdownViewer
                      chatId="thought-process"
                      message={{ [CHAT_MESSAGE_TYPE.AI_REPLY]: value }}
                      settings={settings}
                      projectUuid={projectUuid}
                      projectName={projectName}
                      workspaceID={workspaceID}
                      className={className}
                      canPreviewLinkedFile={false}
                    />
                  ),
                }
              ]
            }
          ];
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
            return {
              name: `${gettext('Step')} ${stepNumber + 1}: ${tool_calls?.[0].name}`,
              children: [
                {
                  name: gettext('Arguments'),
                  children: tool_calls?.[0].name === 'generate_markdown' ? [
                    {
                      name: gettext('File name'),
                      value: tool_calls?.[0]?.arguments.file_name,
                    }, {
                      name: gettext('Content'),
                      children: [
                        {
                          value: tool_calls?.[0]?.arguments.content,
                          formatter: ({ className, value }) => (
                            <CustomizeMarkdownViewer
                              chatId="thought-process"
                              message={{ [CHAT_MESSAGE_TYPE.AI_REPLY]: value }}
                              settings={settings}
                              projectUuid={projectUuid}
                              projectName={projectName}
                              workspaceID={workspaceID}
                              className={className}
                              canPreviewLinkedFile={false}
                            />
                          ),
                        }
                      ]
                    },
                  ] : Object.entries(tool_calls?.[0]?.arguments || {}).map(([argumentKey, argumentValue]) => {
                    return `${argumentKey}: ${argumentValue}`;
                  })
                },
                ...otherInfos
              ],
            };
          }
          let stepChildren = [];
          if (action.tool_calls.length > 1){
            stepChildren.push({
              name: gettext('Substep'),
              children: action.tool_calls.map((too_call, toolIndex) => {
                return {
                  name: `${gettext('Substep')} ${toolIndex + 1}: ${too_call.name}`,
                  children: Object.entries(too_call.arguments || {}).map(([argumentKey, argumentValue]) => {
                    return `${argumentKey}: ${argumentValue}`;
                  })
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
    if (final_answer && final_answer.result){
      let result = final_answer.result;
      if (result && isObject(result)) {
        result = JSON.stringify(result);
      }
      let finalAnswerValue = [{
        name: final_answer.reach_max_steps ? gettext('Result_reached_max_steps') : gettext('Result'),
        children: [
          {
            value: result,
            formatter: result ? ({ className, value }) => (
              <CustomizeMarkdownViewer
                chatId="thought-process"
                message={{ [CHAT_MESSAGE_TYPE.AI_REPLY]: value }}
                settings={settings}
                projectUuid={projectUuid}
                projectName={projectName}
                workspaceID={workspaceID}
                className={className}
                canPreviewLinkedFile={false}
              />
            ) : null
          }
        ]
      }];
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
