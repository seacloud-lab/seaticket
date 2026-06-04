import React, { useCallback, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '@/constants';
import { CenteredLoading, IconTooltip, toaster, ModalHeader } from '@/components';
import { getConnectionIcon } from '@/project/main-panel/connections/utils';
import { CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { Utils } from '@/utils/utils';

import './index.css';

const CloseLinkedGitHubIssuesWarningDialog = ({ tickets, onToggle, onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggle = useCallback((event) => {
    event?.stopPropagation();
    event?.nativeEvent?.stopImmediatePropagation();
    onToggle && onToggle();
  }, [onToggle]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onSubmit && onSubmit((error) => {
      if (error) {
        toaster.danger(Utils.getErrorMsg(error));
      }
      setIsSubmitting(false);
    });
  }, [isSubmitting, onSubmit]);

  const iconSrc = getConnectionIcon(CONNECTION_TYPE.GITHUB_ISSUE);

  return (
    <Modal isOpen={true} className="seaqa-close-linked-github-issues-dialog" toggle={handleToggle}>
      <ModalHeader toggle={handleToggle}>{gettext('Close linked GitHub issues')}</ModalHeader>
      <ModalBody style={{ maxHeight: window.innerHeight - 184 }}>
        <div className="seaqa-tip-default">
          {tickets.length === 1 ?
            gettext('Please confirm that you want to close this ticket along with its linked GitHub issues.')
            :
            gettext('Please confirm that you want to close these tickets along with its linked GitHub issues.')
          }
        </div>
        {tickets.map((ticket) => (
          <div key={ticket.ticket_id} className="seaqa-ticket-close-linked-github-issues-content">
            <div className="seaqa-ticket-close-linked-github-issues-title">
              {ticket.ticket_title || ''}
            </div>
            <div className="seaqa-ticket-close-linked-github-issue">
              {(ticket.open_github_issues || []).map((issue) => (
                <div className="link-item" key={`${issue.connection_id}-${issue.record_pk}`}>
                  <img src={iconSrc} alt="" className="connection-icon" />
                  <span className="link-item-name" title={issue.title}>{issue.title}</span>
                  <IconTooltip icon="dot-circle-stroked" tip={gettext('Open')} placement="bottom" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={handleToggle} disabled={isSubmitting}>
          {gettext('Cancel')}
        </Button>
        <Button color="primary" onClick={handleSubmit} disabled={isSubmitting} style={{ height: 38 }}>
          {isSubmitting ? (<CenteredLoading />) : (<>{gettext('Confirm')}</>)}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CloseLinkedGitHubIssuesWarningDialog;
