import React, { useCallback, useRef, useState } from 'react';
import { FormGroup, Input, Label } from 'reactstrap';
import { SaveStatus, SettingsItem, SwitchSettings } from '@/components';
import { gettext } from '@/constants';
import { WELCOME_EMAIL_SUBJECT_MAX_LENGTH, WELCOME_EMAIL_CONTENT_MAX_LENGTH } from '@/project/constants';
import { isEnterWithoutComposition } from '@/utils/hotkey';
import { usePortalSettings } from '../hooks';

import './index.css';

const Main = ({
  enableSendEmail,
  onChange,
  ...props
}) => {
  const [welcomeEmailSubject, setWelcomeEmailSubject] = useState(props?.welcomeEmailSubject || '');
  const [welcomeEmailContent, setWelcomeEmailContent] = useState(props?.welcomeEmailContent || '');

  const welcomeEmailSubjectRef = useRef(null);

  const handleWelcomeEmailSubjectChange = useCallback((callback) => {
    const validValue = welcomeEmailSubject.trim();
    onChange && onChange({ welcome_email_subject: validValue }, callback);
  }, [welcomeEmailSubject, onChange]);

  const handleWelcomeEmailContentChange = useCallback((callback) => {
    const validValue = welcomeEmailContent.trim();
    onChange && onChange({ welcome_email_content: validValue }, callback);
  }, [welcomeEmailContent, onChange]);

  const onKeyDown = useCallback((event, domRef) => {
    if (isEnterWithoutComposition(event)) {
      event.preventDefault();
      domRef?.current?.blur();
    }
  }, []);

  return (
    <SettingsItem title={gettext('Email notifications')} className="seaqa-portal-email-notifications-settings">
      <SaveStatus callback={(callback, update) => onChange(update, callback)}>
        {({ callback, onContentChange }) => (
          <SwitchSettings
            value={enableSendEmail}
            isFullWidth={false}
            onChange={(newValue) => {
              onContentChange();
              callback({ enable_send_email: newValue });
            }}
            placeholder={gettext('Automatically send a welcome email when a user is added to the portal')}
          />
        )}
      </SaveStatus>
      <div className="seaqa-portal-email-notifications-editor-container my-4">
        <SaveStatus type="custom input" callback={handleWelcomeEmailSubjectChange}>
          {({ callback, saveStatus, onContentChange }) => (
            <FormGroup className="mb-4">
              <Label className="d-inline-flex align-items-center gap-4">
                <span>{gettext('Email subject')}</span>
                {saveStatus}
              </Label>
              <Input
                innerRef={welcomeEmailSubjectRef}
                type="text"
                value={welcomeEmailSubject}
                onChange={event => {
                  onContentChange();
                  setWelcomeEmailSubject(event.target.value);
                }}
                maxLength={WELCOME_EMAIL_SUBJECT_MAX_LENGTH}
                disabled={!enableSendEmail}
                onBlur={enableSendEmail && welcomeEmailSubject.trim() !== props?.welcomeEmailSubject ? callback : undefined}
                onKeyDown={(event) => onKeyDown(event, welcomeEmailSubjectRef)}
              />
            </FormGroup>
          )}
        </SaveStatus>
        <SaveStatus type="custom input" callback={handleWelcomeEmailContentChange}>
          {({ saveStatus, callback, onContentChange }) => (
            <FormGroup type="custom" className="mb-4">
              <Label className="d-inline-flex align-items-center gap-4">
                <span>{gettext('Email content')}</span>
                {saveStatus}
              </Label>
              <textarea
                className="form-control portal-welcome-email-content"
                rows="8"
                value={welcomeEmailContent}
                onChange={event => {
                  onContentChange();
                  setWelcomeEmailContent(event.target.value);
                }}
                maxLength={WELCOME_EMAIL_CONTENT_MAX_LENGTH}
                disabled={!enableSendEmail}
                onBlur={enableSendEmail && welcomeEmailContent.trim() !== props?.welcomeEmailContent ? callback : undefined}
              />
            </FormGroup>
          )}
        </SaveStatus>
      </div>
      <div className="seaqa-tip-default font-size-12 line-height-20">
        {gettext('To insert the portal name, use {portal_name} in the field.')}
      </div>
    </SettingsItem>
  );
};

const EmailNotifications = () => {
  const { settings, updateSettings } = usePortalSettings();
  const { enable_send_email, welcome_email_subject, welcome_email_content } = settings;

  return (
    <Main
      enableSendEmail={enable_send_email}
      welcomeEmailSubject={welcome_email_subject}
      welcomeEmailContent={welcome_email_content}
      onChange={updateSettings}
    />
  );
};

export default EmailNotifications;
