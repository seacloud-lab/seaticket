import { useEffect, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { ModalHeader } from '@/components';
import { gettext } from '@/constants';
import ProcessDetails from '../../thought-process/thought-process-dialog/process-details';
import StepMarkdownViewer from '../../thought-process/thought-process-dialog/markdown-viewer';

import './index.css';

const ToolCallsDialog = ({ value: propsValue, onToggle }) => {
  const [isLoading, setLoading] = useState(true);
  const [value, setValue] = useState([]);

  useEffect(() => {
    let value = [
      {
        name: gettext('Tool calls'),
        children: propsValue.map((toolCall, toolCallNum) => {
          let stepInfos = [{
            name: gettext('Arguments'),
            children: Object.entries(toolCall.arguments || {}).map(([argumentKey, argumentValue]) => {
              return `${argumentKey}: ${argumentValue}`;
            })
          }];
          if (toolCall.output) {
            stepInfos.push({
              name: gettext('Output'),
              children: [
                { value: toolCall.output, formatter: StepMarkdownViewer }
              ]
            });
          }
          if (toolCall.error) {
            stepInfos.push({
              name: gettext('Error'),
              children: [
                { name: gettext('Error type'), value: toolCall.error.type },
                { name: gettext('Error message'), value: toolCall.error.message },
              ]
            });
          }
          return {
            name: `${gettext('Step')} ${toolCallNum + 1}: ${toolCall.name}`,
            children: stepInfos
          };
        })
      }
    ];

    setValue(value);
    setLoading(false);
  }, [propsValue]);

  return (
    <Modal isOpen={true} toggle={onToggle} className="sea-qa-ai-tool-calls-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Tool calls')}</ModalHeader>
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

export default ToolCallsDialog;
