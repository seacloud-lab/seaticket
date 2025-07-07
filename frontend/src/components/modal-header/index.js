import React from 'react';
import { ModalHeader as DefaultModalHeader } from 'reactstrap';
import IconButton from '../icon-button';

import './index.css';

const ModalHeader = ({ children, ...props }) => {
  const customCloseBtn = (
    <button type="button" className="close sea-qa-modal-close" data-dismiss="modal" aria-label="Close" onClick={props.toggle}>
      <IconButton icon="x" className="sea-qa-modal-close-inner" />
    </button>
  );
  return (
    <DefaultModalHeader {...props} close={customCloseBtn}>
      {children}
    </DefaultModalHeader>
  );
};

export default ModalHeader;
