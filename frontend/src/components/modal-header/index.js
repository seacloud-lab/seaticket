import React from 'react';
import { ModalHeader } from 'reactstrap';
import IconButton from '../icon-button';

import './index.css';

const CustomModalHeader = ({ children, ...props }) => {
  const customCloseBtn = (
    <button type="button" className="close sea-qa-modal-close" data-dismiss="modal" aria-label="Close" onClick={props.toggle}>
      <IconButton icon="x" className="sea-qa-modal-close-inner" />
    </button>
  );
  return (
    <ModalHeader {...props} close={customCloseBtn}>
      {children}
    </ModalHeader>
  );
};

export default CustomModalHeader;
