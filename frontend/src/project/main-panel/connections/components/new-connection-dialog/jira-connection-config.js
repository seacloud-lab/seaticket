import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { Button, FormGroup, Input, Label, Modal, ModalBody } from 'reactstrap';
import { gettext } from '@/constants';
import { Icon, Loading, ModalHeader } from '@/components';

const JiraConfig = ({
  isJiraOauthConnected,
  isSubmitting,
  isCheckingJiraOauth,
  isWaitingJiraOAuth,
  setWaitingJiraOAuth,
  jiraOauthError,
  handleConnectJira,
  name,
  onNameChange,
  basicCustomColumns,
  renderConnectionField,
}) => {
  return (
    <div className="seaqa-project-new-connection-config">
      <FormGroup>
        <Label>{gettext('Authorization')}</Label>
        <div className="seaqa-project-jira-oauth">
          <span className={classnames('jira-oauth-status', { connected: isJiraOauthConnected })}>
            <span className="jira-status-icon d-flex">
              <Icon symbol={isJiraOauthConnected ? 'check-circle-filled' : 'close-circle-filled'} />
            </span>
            {isJiraOauthConnected ? gettext('Connected') : gettext('Not connected')}
          </span>
          <Button
            color={isJiraOauthConnected ? 'secondary' : 'primary'}
            disabled={isSubmitting || isCheckingJiraOauth || isWaitingJiraOAuth}
            onClick={handleConnectJira}
          >
            {isJiraOauthConnected ? gettext('Reconnect Jira') : gettext('Connect Jira')}
          </Button>
          {jiraOauthError && (<div className="text-danger">{jiraOauthError}</div>)}
        </div>
      </FormGroup>
      <FormGroup>
        <Label>
          {gettext('Connection name')}
          <span className="required-tip" title={gettext('Required')}>{'*'}</span>
        </Label>
        <Input value={name} onChange={onNameChange} disabled={isSubmitting} />
      </FormGroup>
      {basicCustomColumns.map(renderConnectionField)}
      <Modal
        isOpen={isWaitingJiraOAuth}
        toggle={() => setWaitingJiraOAuth(false)}
        centered
        backdrop="static"
        keyboard={false}
        className="seaqa-project-connection-oauth-modal"
      >
        <ModalHeader toggle={() => setWaitingJiraOAuth(false)}>
          {gettext('Jira authorization')}
        </ModalHeader>
        <ModalBody>
          <div className="seaqa-project-connection-oauth-pending">
            <Loading />
            <div className="mt-3">{gettext('Waiting for Jira authorization to complete...')}</div>
          </div>
        </ModalBody>
      </Modal>
    </div>
  );
};

JiraConfig.propTypes = {
  isJiraOauthConnected: PropTypes.bool.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  isCheckingJiraOauth: PropTypes.bool.isRequired,
  isWaitingJiraOAuth: PropTypes.bool.isRequired,
  setWaitingJiraOAuth: PropTypes.func.isRequired,
  jiraOauthError: PropTypes.string.isRequired,
  handleConnectJira: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  onNameChange: PropTypes.func.isRequired,
  basicCustomColumns: PropTypes.array.isRequired,
  renderConnectionField: PropTypes.func.isRequired,
};

export default JiraConfig;
