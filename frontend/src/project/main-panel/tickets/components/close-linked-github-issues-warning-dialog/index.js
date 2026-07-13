import React, { useCallback, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '@/constants';
import { CenteredLoading, IconTooltip, toaster, ModalHeader } from '@/components';
import { getConnectionIcon } from '@/project/main-panel/connections/utils';
import { CONNECTION_TYPE } from '@/project/main-panel/connections/constants';
import { Utils } from '@/utils/utils';

import './index.css';

const SUBMIT_ACTION = {
  TICKET_ONLY: 'ticket_only',
  TICKET_AND_GITHUB_ISSUES: 'ticket_and_github_issues',
};

const CloseLinkedGitHubIssuesWarningDialog = ({
  ticket,
  onToggle,
  onCloseTicketOnly,
  onCloseTicketAndGitHubIssues,
}) => {
  const [submittingAction, setSubmittingAction] = useState(null);
  const isSubmitting = submittingAction !== null;

  const handleToggle = useCallback((event) => {
    event?.stopPropagation();
    event?.nativeEvent?.stopImmediatePropagation();
    onToggle && onToggle();
  }, [onToggle]);

  const handleSubmit = useCallback((action, callback) => {
    if (isSubmitting) return;
    setSubmittingAction(action);
    Promise.resolve(callback()).catch(error => {
      toaster.danger(Utils.getErrorMsg(error));
      setSubmittingAction(null);
    });
  }, [isSubmitting]);

  const iconSrc = getConnectionIcon(CONNECTION_TYPE.GITHUB_ISSUE);

  return (
    <Modal isOpen={true} className="seaqa-close-linked-github-issues-dialog" toggle={handleToggle}>
      <ModalHeader toggle={handleToggle}>{gettext('Close linked GitHub issues')}</ModalHeader>
      <ModalBody style={{ maxHeight: window.innerHeight - 184 }}>
        <div className="seaqa-ticket-close-linked-github-issue">
          {(ticket?.open_github_issues || []).map((issue) => (
            <div className="link-item" key={`${issue.connection_id}-${issue.record_pk}`}>
              <img src={iconSrc} alt="" className="connection-icon" />
              <span className="link-item-name" title={issue.title}>{issue.title}</span>
              <IconTooltip icon="dot-circle-stroked" tip={gettext('Open')} placement="bottom" />
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          color="secondary"
          onClick={() => handleSubmit(SUBMIT_ACTION.TICKET_ONLY, onCloseTicketOnly)}
          disabled={isSubmitting}
          style={{ height: 38 }}
        >
          {submittingAction === SUBMIT_ACTION.TICKET_ONLY ? (<CenteredLoading />) : (<>{gettext('Close ticket only')}</>)}
        </Button>
        <Button
          color="primary"
          onClick={() => handleSubmit(SUBMIT_ACTION.TICKET_AND_GITHUB_ISSUES, onCloseTicketAndGitHubIssues)}
          disabled={isSubmitting}
          style={{ height: 38 }}
        >
          {submittingAction === SUBMIT_ACTION.TICKET_AND_GITHUB_ISSUES ? (<CenteredLoading />) : (<>{gettext('Close ticket & GitHub issues')}</>)}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CloseLinkedGitHubIssuesWarningDialog;
