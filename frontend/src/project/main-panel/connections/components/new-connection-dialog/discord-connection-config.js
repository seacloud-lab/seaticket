import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { gettext } from '@/constants';
import { Icon } from '@/components';

const DiscordConfig = ({
  isSubmitting,
  config,
  name,
  onNameChange,
  basicCustomColumns,
  renderConnectionField,
  handleConnectDiscord,
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
      <div className="seaqa-project-discord-oauth">
        <span className={classnames('discord-oauth-status', { connected: config.guild_id })}>
          <span className="discord-status-icon d-flex">
            <Icon symbol={config.guild_id ? 'check-circle-filled' : 'close-circle-filled'} />
          </span>
          {config.guild_id ? (config.guild_name || config.guild_id) : gettext('Not connected')}
        </span>
        <Button color={config.guild_id ? 'secondary' : 'primary'} disabled={isSubmitting} onClick={handleConnectDiscord}>
          {config.guild_id ? gettext('Reinstall Discord') : gettext('Install Discord Bot')}
        </Button>
      </div>
    </FormGroup>
    {basicCustomColumns.map(renderConnectionField)}
  </div>
);

DiscordConfig.propTypes = {
  isSubmitting: PropTypes.bool.isRequired,
  config: PropTypes.object.isRequired,
  name: PropTypes.string.isRequired,
  onNameChange: PropTypes.func.isRequired,
  basicCustomColumns: PropTypes.array.isRequired,
  renderConnectionField: PropTypes.func.isRequired,
  handleConnectDiscord: PropTypes.func.isRequired,
};

export default DiscordConfig;
