import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FormGroup, Input, Label } from 'reactstrap';
import { SaveStatus, SettingsItem } from '@/components';
import { gettext } from '@/constants';
import { isEnterWithoutComposition } from '@/utils/hotkey';
import { usePortalSettings } from '../hooks';
import { getInputCheckError } from '../utils';
import PortalChatSourceSelector from './chat-source-selector';

import './index.css';

const ChatLimitInput = ({ label, name, unit, value, onSave }) => {
  const [draftValue, setDraftValue] = useState(String(value));

  const inputRef = useRef(null);
  const hasUnsavedDraft = useRef(false);
  const draftVersion = useRef(0);
  const draftValueRef = useRef(String(value));

  useEffect(() => {
    if (hasUnsavedDraft.current) return;
    const savedValue = String(value);
    draftValueRef.current = savedValue;
    setDraftValue(savedValue);
  }, [value]);

  const onKeyDown = useCallback((event) => {
    if (isEnterWithoutComposition(event)) {
      event.preventDefault();
      inputRef?.current?.blur();
    }
  }, []);

  const handleBlur = (callback) => {
    const parsedValue = Number(draftValue);
    if (!Number.isInteger(parsedValue) || parsedValue < 0) {
      hasUnsavedDraft.current = false;
      const savedValue = String(value);
      draftValueRef.current = savedValue;
      setDraftValue(savedValue);
      const error = getInputCheckError(gettext('%s is invalid and has been automatically reset to the last valid value.').replace('%s', label));
      callback && callback({ error });
      return;
    }
    const submittedDraftVersion = draftVersion.current;
    onSave({ [name]: parsedValue }, ({ error } = {}) => {
      const currentDraftMatchesSubmittedValue = Number(draftValueRef.current) === parsedValue;
      const currentDraftMatchesPreviousValue = Number(draftValueRef.current) === value;
      if (!error) {
        if (draftVersion.current === submittedDraftVersion || currentDraftMatchesSubmittedValue) {
          hasUnsavedDraft.current = false;
          const savedValue = String(parsedValue);
          draftValueRef.current = savedValue;
          setDraftValue(savedValue);
        } else {
          hasUnsavedDraft.current = true;
        }
      } else if (draftVersion.current !== submittedDraftVersion && currentDraftMatchesPreviousValue) {
        hasUnsavedDraft.current = false;
        const savedValue = String(value);
        draftValueRef.current = savedValue;
        setDraftValue(savedValue);
      } else {
        hasUnsavedDraft.current = true;
      }
      callback({ error });
    });
  };

  return (
    <SaveStatus type="input" callback={handleBlur}>
      {({ callback, onContentChange }) => (
        <div className="seaqa-portal-chat-limit-row">
          <div className="seaqa-portal-chat-limit-title">{label}</div>
          <Input
            type="number"
            innerRef={inputRef}
            className="seaqa-portal-chat-limit-input"
            min="0"
            value={draftValue}
            onChange={event => {
              onContentChange();
              draftVersion.current += 1;
              draftValueRef.current = event.target.value;
              hasUnsavedDraft.current = true;
              setDraftValue(event.target.value);
            }}
            onBlur={Number(draftValue) === value ? undefined : callback}
            onKeyDown={onKeyDown}
          />
          <span className="seaqa-tip-default font-size-12 seaqa-portal-chat-limit-unit">{unit}</span>
        </div>
      )}
    </SaveStatus>
  );
};

const Main = ({ connections, settings, onChange }) => {
  return (
    <>
      <SettingsItem title={gettext('Chat sources')} className="seaqa-portal-chat-sources-settings">
        <FormGroup className="mb-4">
          <Label className="seaqa-tip-default font-size-12 line-height-20 mb-4">
            {gettext('Select which data sources can be used for AI responses in the portal.')}
          </Label>
          <PortalChatSourceSelector
            connections={connections}
            value={settings.chat_allowed_sources}
            onChange={(value, callback) => onChange({ chat_allowed_sources: value }, callback)}
          />
        </FormGroup>
      </SettingsItem>
      <SettingsItem title={gettext('Chat limits')} className="seaqa-portal-chat-limits-settings mb-4">
        <div className="seaqa-portal-chat-limits">
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
    </>
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
