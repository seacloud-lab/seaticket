import React, { useEffect, useState } from 'react';
import { FormGroup, Input, Label } from 'reactstrap';
import { SettingsItem } from '@/components';
import { gettext } from '@/constants';
import { usePortalSettings } from '../hooks';
import PortalChatSourceSelector from './chat-source-selector';

import './index.css';

const ChatLimitInput = ({ label, name, unit, value, onSave }) => {
  const [draftValue, setDraftValue] = useState(String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  const handleBlur = () => {
    const parsedValue = Number(draftValue);
    if (!Number.isInteger(parsedValue) || parsedValue < 0) {
      setDraftValue(String(value));
      return;
    }
    if (parsedValue !== value) onSave({ [name]: parsedValue });
  };

  return (
    <div className="seaqa-portal-chat-limit-row">
      <Label className="mb-0">{label}</Label>
      <Input
        type="number"
        min="0"
        value={draftValue}
        onChange={event => setDraftValue(event.target.value)}
        onBlur={handleBlur}
      />
      <span className="seaqa-tip-default font-size-12">{unit}</span>
    </div>
  );
};

const Main = ({ connections, settings, onChange }) => {
  return (
    <SettingsItem title={gettext('Chat sources')} className="seaqa-portal-chat-sources-settings">
      <FormGroup className="mb-4">
        <Label className="seaqa-tip-default font-size-12 line-height-20 mb-4">
          {gettext('Select which data sources can be used for AI responses in the portal.')}
        </Label>
        <PortalChatSourceSelector
          connections={connections}
          value={settings.chat_allowed_sources}
          onChange={(value) => onChange({ chat_allowed_sources: value })}
        />
      </FormGroup>
      <div className="seaqa-portal-chat-limits">
        <Label className="seaqa-portal-chat-limits-title">{gettext('Chat limits')}</Label>
        <p className="seaqa-tip-default font-size-12 line-height-20">
          {gettext('Configure the request and credit limits for portal chat. The time periods are fixed.')}
        </p>
        <ChatLimitInput
          label={gettext('Credit limit')}
          name="daily_chat_credit_limit"
          unit={gettext('credit / day')}
          value={settings.daily_chat_credit_limit}
          onSave={onChange}
        />
        <ChatLimitInput
          label={gettext('External user')}
          name="external_chat_user_rate_limit"
          unit={gettext('requests / 10 minutes')}
          value={settings.external_chat_user_rate_limit}
          onSave={onChange}
        />
        <ChatLimitInput
          label={gettext('Anonymous visitor')}
          name="anonymous_chat_session_daily_limit"
          unit={gettext('requests / day')}
          value={settings.anonymous_chat_session_daily_limit}
          onSave={onChange}
        />
        <ChatLimitInput
          label={gettext('Anonymous IP')}
          name="anonymous_chat_ip_daily_limit"
          unit={gettext('requests / day')}
          value={settings.anonymous_chat_ip_daily_limit}
          onSave={onChange}
        />
      </div>
    </SettingsItem>
  );
};

const PortalChatSettings = () => {
  const { settings, updateSettings, connections } = usePortalSettings();
  return (
    <Main
      connections={connections}
      settings={settings}
      onChange={updateSettings}
    />
  );
};

export default PortalChatSettings;
