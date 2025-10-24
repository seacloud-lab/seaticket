import { useEffect, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { ModalHeader } from '@/components';
import { gettext } from '@/constants';
import ProcessDetails from './process-details';
import StepMarkdownViewer from './markdown-viewer';
import { isObject } from '@/utils/type-detection';

import './index.css';

const ThoughtProcessDialog = ({ value: propsValue, onToggle }) => {
  const [isLoading, setLoading] = useState(true);
  const [value, setValue] = useState([]);

  useEffect(() => {
    // task
    let value = [
      {
        name: gettext('Task step'),
        children: [
          {
            name: gettext('System prompts'),
            children: [
              { value: propsValue.task?.system_prompts, formatter: StepMarkdownViewer }
            ]
          }, {
            name: gettext('User message'),
            children: [
              { value: propsValue.task?.user_input, formatter: StepMarkdownViewer }
            ]
          }
        ]
      }
    ];

    // context
    if (propsValue.context?.length > 0) {
      value.push({
        name: gettext('Context'),
        children: propsValue.context.map(record => {
          return {
            name: `${gettext('Date')}: ${record.date}`,
            children: [
              {
                name: gettext('User message'),
                children: [
                  { value: record.user_input }
                ],
              }, {
                name: gettext('Assistant reponse'),
                children: record.assistant_response.length <= 1 ? [
                  {
                    name: gettext('Answer'),
                    children: [
                      { value: record.assistant_response?.[0]?.content?.answer, formatter: StepMarkdownViewer }
                    ]
                  }, {
                    name: gettext('Sources'),
                    children: [
                      { value: record.assistant_response?.[0]?.content?.sources, formatter: StepMarkdownViewer }
                    ]
                  }
                ] : Object.entries(record.assistant_response).map(([responseDate, responseContent], responseIndex) => {
                  return {
                    name: `${gettext('Response')} ${responseIndex + 1}: (${gettext('Date')}: ${responseDate})`,
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
    value.push({
      name: gettext('Action steps'),
      children: propsValue.actions.map((action, stepNumber) => {
        return {
          name: `${gettext('Step')} ${stepNumber + 1}: ${action.tool_calls?.length === 1 ? action.tool_calls?.[0].name : ''}`,
          children: [
            (
              action.tool_calls?.length === 1 ? {
                name: gettext('Arguments'),
                children: Object.entries(action.tool_calls?.[0]?.arguments || {}).map(([argumentKey, argumentValue], argumentIndex) => {
                  return {
                    name: `${gettext('Argument')} ${argumentIndex + 1}: ${argumentKey}`,
                    children: [
                      { value: argumentValue }
                    ]
                  };
                })
              } : Object.entries(action.tool_calls).map(([toolName, toolArguments], toolIndex) => {
                return {
                  name: `${gettext('Substep')} ${toolIndex + 1}: ${toolName}`,
                  children: Object.entries(toolArguments || {}).map(([argumentKey, argumentValue], argumentIndex) => {
                    return {
                      name: `${gettext('Argument')} ${argumentIndex + 1}: ${argumentKey}`,
                      children: [
                        { value: argumentValue }
                      ]
                    };
                  })
                };
              })
            ), action.error ? {
              name: gettext('Error'),
              children: [
                { name: gettext('Error type'), value: action.error.type },
                { name: gettext('Error message'), value: action.error.message },
                { name: gettext('Step output'), value: action.result, formatter: StepMarkdownViewer },
              ]
            } : {
              name: gettext('Observation'),
              children: [
                { value: action.result, formatter: StepMarkdownViewer }
              ]
            }, {
              name: gettext('Statistics'),
              children: [
                { name: gettext('Input tokens'), value: action.token_usage?.input_tokens || 0 },
                { name: gettext('Output tokens'), value: action.token_usage?.output_tokens || 0 },
                { name: gettext('Total tokens'), value: action.token_usage?.total_tokens || 0 },
                { name: gettext('Time usage'), value: `${action.time_usage || 0} s` },
              ]
            }
          ]
        };
      }),
    });

    // final answer
    if (propsValue.final_answer?.result){
      let result = propsValue.final_answer.result;
      if (result && isObject(result)) {
        result = JSON.stringify(result);
      }

      value.push({
        name: gettext('Answer generation'),
        children: [
          {
            name: propsValue.final_answer.reach_max_steps ? gettext('Result_reached_max_steps') : gettext('Result'),
            children: [
              { value: result, formatter: result ? StepMarkdownViewer : null }
            ]
          }, {
            name: gettext('Statistics'),
            children: [
              { name: gettext('Input tokens'), value: propsValue.final_answer.token_usage?.input_tokens || 0 },
              { name: gettext('Output tokens'), value: propsValue.final_answer.token_usage?.output_tokens || 0 },
              { name: gettext('Total tokens'), value: propsValue.final_answer.token_usage?.total_tokens || 0 },
              { name: gettext('Time usage'), value: `${propsValue.final_answer.time_usage || 0} s` },
            ]
          }
        ]
      });
    }

    value.push({
      name: gettext('Statistics'),
      children: [
        {
          name: gettext('Token usages'),
          children: [
            {
              name: gettext('Input tokens'),
              children: [
                { name: gettext('Action steps'), value: propsValue.static.token_usage.input_tokens.action_steps },
                { name: gettext('Answer generation'), value: propsValue.static.token_usage.input_tokens.answer_generation },
                { name: gettext('Total'), value: propsValue.static.token_usage.input_tokens.total }
              ]
            }, {
              name: gettext('Output tokens'),
              children: [
                { name: gettext('Action steps'), value: propsValue.static.token_usage.output_tokens.action_steps },
                { name: gettext('Answer generation'), value: propsValue.static.token_usage.output_tokens.answer_generation },
                { name: gettext('Total'), value: propsValue.static.token_usage.output_tokens.total }
              ]
            }, {
              name: gettext('Total tokens'),
              children: [
                { name: gettext('Action steps'), value: propsValue.static.token_usage.total_tokens.action_steps },
                { name: gettext('Answer generation'), value: propsValue.static.token_usage.total_tokens.answer_generation },
                { name: gettext('Total'), value: propsValue.static.token_usage.total_tokens.total }
              ]
            }
          ]
        }, {
          name: gettext('Time usage'),
          children: [
            { name: gettext('Action steps'), value: `${propsValue.static.time_usage.action_steps} s` },
            { name: gettext('Answer generation'), value: `${propsValue.static.time_usage.answer_generation} s` },
            { name: gettext('Total'), value: `${propsValue.static.time_usage.total} s` },
          ]
        }
      ]
    });

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
