/* eslint-disable react-hooks/rules-of-hooks */
import React, { useCallback } from 'react';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import copy from 'copy-to-clipboard';
import ModalHeader from '../../modal-header';
import { gettext } from '@/constants';

import './index.css';

const LinkVerifiedDialog = ({
  onToggle,
  link,
}) => {
  const copyLink = useCallback(() => {
    copy(link);
    onToggle && onToggle();
  }, [link, onToggle]);

  const openLink = useCallback(() => {
    window.open(link);
    onToggle && onToggle();
  }, [link, onToggle]);

  const { host, protocol, pathname } = new URL(link);

  return (
    <Modal isOpen={true} toggle={onToggle} className="seaqa-link-verified-dialog" zIndex={1071}>
      <ModalHeader toggle={onToggle}>
        <span className="mr-2">{gettext('This link is not verified')}</span>
      </ModalHeader>
      <ModalBody>
        <p className="seaqa-tip-default mb-5">
          {gettext('Before continuing, please ensure you trust this link. If you do not trust the URL, do not open the link to access the site.')}
        </p>
        <div className="seaqa-verify-link">
          <span className="seaqa-tip-default">{protocol + '//'}</span>
          <span>{host}</span>
          <span className="seaqa-tip-default">{decodeURIComponent(pathname)}</span>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button onClick={copyLink} className="m-0 mr-2">{gettext('Copy link')}</Button>
        <Button color="primary" className="m-0" onClick={openLink}>{gettext('Open link')}</Button>
      </ModalFooter>
    </Modal>
  );
};

export default LinkVerifiedDialog;
