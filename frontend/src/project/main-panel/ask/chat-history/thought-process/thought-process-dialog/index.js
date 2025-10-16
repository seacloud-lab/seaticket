import { useEffect, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { ModalHeader } from '@/components';
import { gettext } from '@/constants';
import ProcessDetails from './process-details';

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
        {!isLoading && <ProcessDetails value={value} />}
      </ModalBody>
    </Modal>
  );
};

export default ThoughtProcessDialog;
