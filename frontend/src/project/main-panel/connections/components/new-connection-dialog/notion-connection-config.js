import React from 'react';
import { Button, FormGroup, Input, Label, Modal, ModalBody } from 'reactstrap';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { Icon, Loading, ModalHeader } from '@/components';
import { gettext } from '@/constants';

const NotionConfig = ({
  isNotionOauthConnected,
  isSubmitting,
  isCheckingNotionOauth,
  isWaitingNotionOAuth,
  setWaitingNotionOAuth,
  handleConnectNotion,
  notionOauthError,
  name,
  onNameChange,
  basicCustomColumns,
  renderConnectionField,
}) => (
  <div className="seaqa-project-new-connection-config">
    <FormGroup>
      <Label>
        {gettext('Connection name')}
        <span className="required-tip" title={gettext('Required')}>{'*'}</span>
      </Label>
      <Input value={name} onChange={onNameChange} disabled={isSubmitting} />
    </FormGroup>
    <FormGroup>
      <Label>{gettext('Authorization')}</Label>
      <div className="seaqa-project-notion-oauth">
        <span className={classnames('notion-oauth-status', { connected: isNotionOauthConnected })}>
          <span className="notion-status-icon d-flex">
            <Icon symbol={isNotionOauthConnected ? 'check-circle-filled' : 'close-circle-filled'} />
          </span>
          {isNotionOauthConnected ? gettext('Connected') : gettext('Not connected')}
        </span>
        <Button
          color={isNotionOauthConnected ? 'secondary' : 'primary'}
          disabled={isSubmitting || isCheckingNotionOauth || isWaitingNotionOAuth}
          onClick={handleConnectNotion}
        >
          {isNotionOauthConnected ? gettext('Reconnect Notion') : gettext('Connect Notion')}
        </Button>
        {notionOauthError && (<div className="text-danger mt-2">{notionOauthError}</div>)}
      </div>
    </FormGroup>
    {basicCustomColumns.map(renderConnectionField)}
    <Modal
      isOpen={isWaitingNotionOAuth}
      toggle={() => setWaitingNotionOAuth(false)}
      centered
      backdrop="static"
      keyboard={false}
      className="seaqa-project-connection-oauth-modal"
    >
      <ModalHeader toggle={() => setWaitingNotionOAuth(false)}>
        {gettext('Notion authorization')}
      </ModalHeader>
      <ModalBody>
        <div className="seaqa-project-connection-oauth-pending">
          <Loading />
          <div className="mt-3">{gettext('Waiting for Notion authorization to complete...')}</div>
        </div>
      </ModalBody>
    </Modal>
  </div>
);

NotionConfig.propTypes = {
  isNotionOauthConnected: PropTypes.bool.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  isCheckingNotionOauth: PropTypes.bool.isRequired,
  isWaitingNotionOAuth: PropTypes.bool.isRequired,
  setWaitingNotionOAuth: PropTypes.func.isRequired,
  handleConnectNotion: PropTypes.func.isRequired,
  notionOauthError: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onNameChange: PropTypes.func.isRequired,
  basicCustomColumns: PropTypes.array.isRequired,
  renderConnectionField: PropTypes.func.isRequired,
};

export default NotionConfig;
