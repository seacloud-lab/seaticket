import React from 'react';
import { FormGroup, Label } from 'reactstrap';
import { SettingsItem } from '@/components';
import { gettext } from '@/constants';
import { usePortalSettings } from '../hooks';
import PortalChatSourceSelector from './chat-source-selector';

const Main = ({ connections, chatSettings, onChange }) => {
  return (
    <SettingsItem title={gettext('Chat sources')} className="seaqa-portal-chat-sources-settings">
      <FormGroup className="mb-4">
        <Label className="seaqa-tip-default font-size-12 line-height-20 mb-4">
          {gettext('Select which data sources can be used for AI responses in the portal.')}
        </Label>
        <PortalChatSourceSelector
          connections={connections}
          value={chatSettings}
          onChange={(value) => onChange({ chat_allowed_sources: value })}
        />
      </FormGroup>
    </SettingsItem>
  );
};

const PortalChatSettings = () => {
  const { settings, updateSettings, connections } = usePortalSettings();
  const { chat_allowed_sources } = settings;
  return (
    <Main
      connections={connections}
      chatSettings={chat_allowed_sources}
      onChange={updateSettings}
    />
  );
};

export default PortalChatSettings;
