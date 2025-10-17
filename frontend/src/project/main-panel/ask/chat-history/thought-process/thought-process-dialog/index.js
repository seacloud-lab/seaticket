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
    const actionSteps = propsValue.filter(step => !step.is_final_answer && step.tool_calls.length > 0);
    const finalAnswerStep = propsValue.find(step => step.is_final_answer || step.error?.type === 'AgentMaxStepsError');
    let value = [
      {
        name: gettext('Plan step'),
        children: [
          {
            name: gettext('System prompts'),
            children: [
              { value: propsValue[0]?.model_input_messages?.[0]?.content?.[0]?.text, formatter: StepMarkdownViewer }
            ]
          }, {
            name: gettext('User message'),
            children: [
              { value: propsValue[0]?.model_input_messages?.[1]?.content?.[0]?.text.substring(10), formatter: StepMarkdownViewer }
            ]
          }
        ]
      }, {
        name: gettext('Action steps'),
        children: actionSteps.map(step => {
          return {
            name: `${gettext('Step')} ${step.step_number}: ${step.tool_calls?.[0]?.function?.name}`,
            children: [
              {
                name: gettext('Arguments'),
                children: Object.entries(step.tool_calls?.[0]?.function?.arguments || {}).map(([argumentKey, argumentValue], argumentIndex) => {
                  return {
                    name: `${gettext('Argument')} ${argumentIndex + 1}: ${argumentKey}`,
                    children: [
                      { value: argumentValue }
                    ]
                  };
                }),
              }, step.error ? {
                name: gettext('Error'),
                children: [
                  { name: gettext('Error type'), value: step.error.type },
                  { name: gettext('Error message'), value: step.error.message },
                  { name: gettext('Step output'), value: step.action_output, formatter: StepMarkdownViewer },
                ]
              } : {
                name: gettext('Observation'),
                children: [
                  { value: step.observations, formatter: StepMarkdownViewer }
                ]
              }, {
                name: gettext('Other information'),
                children: [
                  { name: gettext('Input tokens'), value: step.token_usage?.input_tokens || 0 },
                  { name: gettext('Output tokens'), value: step.token_usage?.output_tokens || 0 },
                  { name: gettext('Total tokens'), value: step.token_usage?.total_tokens || 0 },
                  { name: gettext('Time usage'), value: `${step.timing?.duration || 0} s` },
                ]
              }
            ]
          };
        }),
      }
    ];
    if (finalAnswerStep) {
      let result = finalAnswerStep.observations || finalAnswerStep.action_output || null;
      if (result && isObject(result)) {
        result = JSON.stringify(result);
      }
      value.push({
        name: gettext('Final answer'),
        children: [
          {
            name: finalAnswerStep.error?.type === 'AgentMaxStepsError' ? gettext('Result_reached_max_steps') : gettext('Result'),
            value: result,
            formatter: result ? StepMarkdownViewer : null,
          }, {
            name: gettext('Other information'),
            children: [
              { name: gettext('Input tokens'), value: finalAnswerStep.token_usage?.input_tokens || 0 },
              { name: gettext('Output tokens'), value: finalAnswerStep.token_usage?.output_tokens || 0 },
              { name: gettext('Total tokens'), value: finalAnswerStep.token_usage?.total_tokens || 0 },
              { name: gettext('Time usage'), value: `${finalAnswerStep.timing?.duration || 0} s` },
            ]
          }
        ]
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
