import React, { useCallback, useState } from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { SettingsItem, SwitchSettings } from '@/components';
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

  const handleWelcomeEmailSubjectChange = useCallback(() => {
    const validValue = welcomeEmailSubject.trim();
    if (props?.welcomeEmailSubject === validValue) return;
    onChange && onChange({ welcome_email_subject: validValue });
  }, [props, welcomeEmailSubject, onChange]);

  const handleWelcomeEmailContentChange = useCallback(() => {
    const validValue = welcomeEmailContent.trim();
    if (props?.welcomeEmailContent === validValue) return;
    onChange && onChange({ welcome_email_content: validValue });
  }, [props, welcomeEmailContent, onChange]);

  return (
    <SettingsItem title={gettext('Email notifications')} className="seaqa-portal-email-notifications-settings">
      <SwitchSettings
        value={enableSendEmail}
        onChange={(newValue) => onChange({ enable_send_email: newValue })}
        placeholder={gettext('Automatically send a welcome email when a user is added to the portal')}
      />
      <div className="seaqa-portal-email-notifications-editor-container my-4">
        <FormGroup className="mb-4">
          <Label>{gettext('Email subject')}</Label>
          <Input
            type="text"
            value={welcomeEmailSubject}
            onChange={event => setWelcomeEmailSubject(event.target.value)}
            maxLength={WELCOME_EMAIL_SUBJECT_MAX_LENGTH}
            disabled={!enableSendEmail}
            onBlur={enableSendEmail ? handleWelcomeEmailSubjectChange : undefined}
          />
        </FormGroup>
        <FormGroup className="mb-4">
          <Label>{gettext('Email content')}</Label>
          <textarea
            className="form-control portal-welcome-email-content"
            rows="8"
            value={welcomeEmailContent}
            onChange={event => setWelcomeEmailContent(event.target.value)}
            maxLength={WELCOME_EMAIL_CONTENT_MAX_LENGTH}
            disabled={!enableSendEmail}
            onBlur={enableSendEmail ? handleWelcomeEmailContentChange : undefined}
          />
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
