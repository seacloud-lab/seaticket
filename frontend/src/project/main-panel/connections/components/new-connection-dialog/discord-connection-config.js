import React from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { gettext } from '@/constants';

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
      <Label>{gettext('Authorization')}</Label>
      <div className="seaqa-project-discord-oauth">
        {config.guild_id && <span className="oauth-status-text mr-3">{config.guild_name || config.guild_id}</span>}
        <Button color="primary" disabled={isSubmitting} onClick={handleConnectDiscord}>
          {config.guild_id ? gettext('Reinstall Discord') : gettext('Install Discord Bot')}
        </Button>
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
