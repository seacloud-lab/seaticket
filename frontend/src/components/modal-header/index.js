import React from 'react';
import { ModalHeader as DefaultModalHeader } from 'reactstrap';
import IconButton from '../icon-button';
import { gettext } from '@/constants';

import './index.css';

const ModalHeader = ({ children, ...props }) => {
  return (
    <DefaultModalHeader {...props} close={
      <button
        type="button"
        className="close sea-qa-modal-close"
        data-dismiss="modal"
        aria-label={gettext('Close')}
        title={gettext('Close')}
        onClick={props.toggle}
      >
        <IconButton icon="close" className="sea-qa-modal-close-inner" />
      </button>
    }>
      {children}
    </DefaultModalHeader>
  );
};

export default ModalHeader;
