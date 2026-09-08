import React from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { gettext } from '@/constants';
import { Icon } from '@/components';

const SlackConfig = ({
  isSubmitting,
  config,
  name,
  onNameChange,
  basicCustomColumns,
  renderConnectionField,
  handleConnectSlack,
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
      <div className="seaqa-project-connection-oauth-status">
        <span className="oauth-status-badge d-flex align-items-center">
          <Icon symbol={config.team_id ? 'check-circle-filled' : 'close-circle-filled'} />
          <span className="oauth-status-text">{config.team_id ? (config.team_name || config.team_id) : gettext('Not connected')}</span>
        </span>
        <Button
          color={config.team_id ? 'secondary' : 'primary'}
          className="oauth-status-button"
          disabled={isSubmitting}
          onClick={handleConnectSlack}
        >
          {config.team_id ? gettext('Reconnect Slack') : gettext('Connect Slack')}
        </Button>
      </div>
    </FormGroup>
    {basicCustomColumns.map(renderConnectionField)}
  </div>
);

SlackConfig.propTypes = {
  isSubmitting: PropTypes.bool.isRequired,
  config: PropTypes.object.isRequired,
  name: PropTypes.string.isRequired,
  onNameChange: PropTypes.func.isRequired,
  basicCustomColumns: PropTypes.array.isRequired,
  renderConnectionField: PropTypes.func.isRequired,
  handleConnectSlack: PropTypes.func.isRequired,
};

export default SlackConfig;
