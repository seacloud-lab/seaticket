import React, { useCallback, useMemo, useState } from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { SaveStatus, SettingsItem, SwitchSettings } from '@/components';
import { gettext } from '@/constants';
import { WELCOME_EMAIL_SUBJECT_MAX_LENGTH, WELCOME_EMAIL_CONTENT_MAX_LENGTH } from '@/project/constants';
import { usePortalSettings } from '../hooks';

import './index.css';

const Main = ({
  enableSendEmail,
  onChange,
  ...props
}) => {
  const [welcomeEmailSubject, setWelcomeEmailSubject] = useState(props?.welcomeEmailSubject || '');
  const [welcomeEmailContent, setWelcomeEmailContent] = useState(props?.welcomeEmailContent || '');

  const isValidWelcomeEmailSubjectChanged = useMemo(() => {
    const validValue = welcomeEmailSubject.trim();
    if (props?.welcomeEmailSubject === validValue) return false;
    return true;
  }, [props, welcomeEmailSubject]);
  const isValidWelcomeEmailContentChanged = useMemo(() => {
    const validValue = welcomeEmailContent.trim();
    if (props?.welcomeEmailContent === validValue) return false;
    return true;
  }, [props, welcomeEmailContent]);

  const handleWelcomeEmailSubjectChange = useCallback((callback) => {
    const validValue = welcomeEmailSubject.trim();
    if (props?.welcomeEmailSubject === validValue) return;
    onChange && onChange({ welcome_email_subject: validValue }, callback);
  }, [props, welcomeEmailSubject, onChange]);

  const handleWelcomeEmailContentChange = useCallback((callback) => {
    const validValue = welcomeEmailContent.trim();
    if (props?.welcomeEmailContent === validValue) return;
    onChange && onChange({ welcome_email_content: validValue }, callback);
  }, [props, welcomeEmailContent, onChange]);

  return (
    <SettingsItem title={gettext('Email notifications')} className="seaqa-portal-email-notifications-settings">
      <SaveStatus callback={(callback, update) => onChange(update, callback)}>
        {({ callback }) => (
          <SwitchSettings
            value={enableSendEmail}
            onChange={(newValue) => callback({ enable_send_email: newValue })}
            placeholder={gettext('Automatically send a welcome email when a user is added to the portal')}
          />
        )}
      </SaveStatus>
      <div className="seaqa-portal-email-notifications-editor-container my-4">
        <FormGroup className="mb-4">
          <Label>{gettext('Email subject')}</Label>
          <SaveStatus isValidChanged={isValidWelcomeEmailSubjectChanged} callback={handleWelcomeEmailSubjectChange}>
            {({ callback }) => (
              <Input
                type="text"
                value={welcomeEmailSubject}
                onChange={event => setWelcomeEmailSubject(event.target.value)}
                maxLength={WELCOME_EMAIL_SUBJECT_MAX_LENGTH}
                disabled={!enableSendEmail}
                onBlur={enableSendEmail ? callback : undefined}
              />
            )}
          </SaveStatus>
        </FormGroup>
        <FormGroup className="mb-4">
          <Label>{gettext('Email content')}</Label>
          <SaveStatus isValidChanged={isValidWelcomeEmailContentChanged} callback={handleWelcomeEmailContentChange}>
            {({ callback }) => (
              <textarea
                className="form-control portal-welcome-email-content"
                rows="8"
                value={welcomeEmailContent}
                onChange={event => setWelcomeEmailContent(event.target.value)}
                maxLength={WELCOME_EMAIL_CONTENT_MAX_LENGTH}
                disabled={!enableSendEmail}
                onBlur={enableSendEmail ? callback : undefined}
              />
            )}
          </SaveStatus>
        </FormGroup>
        <div className="mt-3">
          <Button color="primary" disabled size="sm">{gettext('Log in')}</Button>
        </div>
      </div>
      <div className="seaqa-tip-default font-size-12 line-height-20">
        {gettext('To insert the portal name, use {portal_name} in the field.')}
      </div>
      <div className="seaqa-tip-default font-size-12 line-height-20 mt-2">
        {gettext('A login button will be added to the end of the email. The button cannot be customized.')}
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
