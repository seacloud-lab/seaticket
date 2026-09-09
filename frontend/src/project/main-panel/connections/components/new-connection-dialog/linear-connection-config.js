import React from 'react';
import { Button, FormGroup, Input, Label, Modal, ModalBody } from 'reactstrap';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { Icon, Loading, ModalHeader } from '@/components';
import { gettext } from '@/constants';

const LinearConfig = ({
  isLinearOauthConnected,
  isSubmitting,
  isCheckingLinearOauth,
  isWaitingLinearOAuth,
  setWaitingLinearOAuth,
  handleConnectLinear,
  linearOauthError,
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
      <div className="seaqa-project-linear-oauth">
        <span className={classnames('linear-oauth-status', { connected: isLinearOauthConnected })}>
          <span className="linear-status-icon d-flex">
            <Icon symbol={isLinearOauthConnected ? 'check-circle-filled' : 'close-circle-filled'} />
          </span>
          {isLinearOauthConnected ? gettext('Connected') : gettext('Not connected')}
        </span>
        <Button
          color={isLinearOauthConnected ? 'secondary' : 'primary'}
          disabled={isSubmitting || isCheckingLinearOauth || isWaitingLinearOAuth}
          onClick={handleConnectLinear}
        >
          {isLinearOauthConnected ? gettext('Reconnect Linear') : gettext('Connect Linear')}
        </Button>
        {linearOauthError && (<div className="text-danger mt-2">{linearOauthError}</div>)}
      </div>
    </FormGroup>
    {basicCustomColumns.map(renderConnectionField)}
    <Modal
      isOpen={isWaitingLinearOAuth}
      toggle={() => setWaitingLinearOAuth(false)}
      centered
      backdrop="static"
      keyboard={false}
      className="seaqa-project-connection-oauth-modal"
    >
      <ModalHeader toggle={() => setWaitingLinearOAuth(false)}>
        {gettext('Linear authorization')}
      </ModalHeader>
      <ModalBody>
        <div className="seaqa-project-connection-oauth-pending">
          <Loading />
          <div className="mt-3">{gettext('Waiting for Linear authorization to complete...')}</div>
        </div>
      </ModalBody>
    </Modal>
  </div>
);

LinearConfig.propTypes = {
  isLinearOauthConnected: PropTypes.bool.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  isCheckingLinearOauth: PropTypes.bool.isRequired,
  isWaitingLinearOAuth: PropTypes.bool.isRequired,
  setWaitingLinearOAuth: PropTypes.func.isRequired,
  handleConnectLinear: PropTypes.func.isRequired,
  linearOauthError: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onNameChange: PropTypes.func.isRequired,
  basicCustomColumns: PropTypes.array.isRequired,
  renderConnectionField: PropTypes.func.isRequired,
};

export default LinearConfig;
