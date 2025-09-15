import { useEffect, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { ModalHeader } from '@/components';
import { gettext } from '@/constants';
import Process from './process';

import './index.css';

const ThoughtProcessDialog = ({ value, onToggle }) => {
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <Modal isOpen={true} toggle={onToggle} className="sea-qa-ai-thought-process-dialog">
      <ModalHeader toggle={onToggle}>{gettext('Thought process')}</ModalHeader>
      <ModalBody>
        {!isLoading && (
          <>
            {value.filter(v => v.tool_calls).map((v, index) => {
              return (<Process value={v} key={index} />);
            })}
          </>
        )}
      </ModalBody>
    </Modal>
  );
};

export default ThoughtProcessDialog;
