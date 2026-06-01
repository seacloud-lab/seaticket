import React, { useCallback } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';
import { gettext } from '@/constants';
import { IconTooltip } from '@/components';
import { getConnectionIcon } from '@/project/main-panel/connections/utils';

import './close-linked-github-issues-warning-dialog.css';

const CloseLinkedGithubIssuesWarningDialog = ({
  warning,
  description,
  isConfirming,
  onCancel,
  onConfirm,
}) => {
  const renderIssueTypeImage = useCallback((type) => {
    const connectionType = type || 'github_issue';
    return (
      <img src={getConnectionIcon(connectionType)} alt="" className="connection-icon" />
    );
  }, []);

  const renderIssueStateIcon = useCallback((issueState) => {
    if (!issueState) return null;
    const stateName = String(issueState).toLowerCase();
    if (stateName === 'open' || stateName === '0001') {
      return <IconTooltip icon="dot-circle-stroked" tip={gettext('Open')} placement="bottom" />;
    }
    if (stateName === 'closed' || stateName === '0002') {
      return <IconTooltip icon="check-circle-stroked" tip={gettext('Closed')} placement="bottom" />;
    }
    return null;
  }, []);

  if (!warning) return null;

  return (
    <Modal isOpen={true} toggle={onCancel}>
      <ModalHeader toggle={onCancel}>{gettext('Linked GitHub issues are still open')}</ModalHeader>
      <ModalBody>
        <p className="mb-2">{description}</p>
        {(warning.tickets || []).map((ticketWarning) => (
          <div key={ticketWarning.ticket_id} className="mb-2">
            <div className="fw-bold">
              {gettext('Ticket')} #{ticketWarning.ticket_id}: {ticketWarning.ticket_title || ''}
            </div>
            <div className="close-linked-github-issues-warning-content">
              {(ticketWarning.open_github_issues || []).map((issue) => (
                <div className="link-item" key={`${issue.connection_id}-${issue.record_pk}`}>
                  {renderIssueTypeImage(issue.type)}
                  <span className="link-item-name" title={issue.title || ''}>
                    #{issue.record_pk} {issue.title || ''}
                  </span>
                  {renderIssueStateIcon(issue.state)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onCancel} disabled={isConfirming}>
          {gettext('Cancel')}
        </Button>
        <Button color="primary" onClick={onConfirm} disabled={isConfirming}>
          {gettext('Confirm and close')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CloseLinkedGithubIssuesWarningDialog;
