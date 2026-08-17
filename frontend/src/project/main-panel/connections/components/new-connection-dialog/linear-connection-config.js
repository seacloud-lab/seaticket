import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { gettext } from '@/constants';
import { Icon } from '@/components';

const LinearConfig = ({
  isLinearOauthConnected,
  isSubmitting,
  isCheckingLinearOauth,
  handleConnectLinear,
  linearOauthError,
  name,
  onNameChange,
  basicCustomColumns,
  renderConnectionField,
}) => (
  <div className="seaqa-project-new-connection-config">
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
          disabled={isSubmitting || isCheckingLinearOauth}
          onClick={handleConnectLinear}
        >
          {isLinearOauthConnected ? gettext('Reconnect Linear') : gettext('Connect Linear')}
        </Button>
        {linearOauthError && (<div className="text-danger mt-2">{linearOauthError}</div>)}
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
  </div>
);

LinearConfig.propTypes = {
  isLinearOauthConnected: PropTypes.bool.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  isCheckingLinearOauth: PropTypes.bool.isRequired,
  handleConnectLinear: PropTypes.func.isRequired,
  linearOauthError: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onNameChange: PropTypes.func.isRequired,
  basicCustomColumns: PropTypes.array.isRequired,
  renderConnectionField: PropTypes.func.isRequired,
};

export default LinearConfig;
