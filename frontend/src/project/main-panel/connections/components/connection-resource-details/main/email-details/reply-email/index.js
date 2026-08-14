import React, { useCallback, useRef, useState } from 'react';
import SeaEmailEditor from '@seafile/sea-email-editor';
import { Button, Input } from 'reactstrap';
import { gettext } from '@/constants';
import SendTo from './send-to';
import { Icon, Loading, toaster } from '@/components';
import { areArraysEqual } from '@/utils/array-utils';
import { isValidEmail } from '@/utils/validate';

import './index.css';

const ReplyEmail = ({
  emailTo: initialEmailTo,
  emailCC: initialEmailCC,
  emailFrom,
  defaultSubject = '',
  initValue,
  isHtmlValue,
  assetURLPrefix,
  onToggle,
  onSubmit,
}) => {
  const [emailContent, setEmailContent] = useState(initValue || '');
  const [subject, setSubject] = useState(defaultSubject);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailToRef = useRef(null);
  const emailCCRef = useRef(null);

  const onReplyChange = useCallback((value) => {
    if (value === emailContent) return;
    setEmailContent(value);
  }, [emailContent]);

  const handleSubmit = useCallback(() => {
    const emailTo = emailToRef.current?.getValue() || [];
    if (emailTo.length === 0) {
      toaster.danger(gettext('Please fill in the recipient\'s address before sending'));
      return;
    }
    const emailCC = emailCCRef.current?.getValue() || [];
    const allInvalidEmails = [...emailTo, ...emailCC].filter(email => !isValidEmail(email));
    if (allInvalidEmails.length === 1) {
      toaster.danger(gettext('This email address is invalid: ') + allInvalidEmails[0]);
      return;
    }
    if (allInvalidEmails.length > 1) {
      toaster.danger(gettext('These email addresses are invalid: ') + allInvalidEmails.join(', '));
      return;
    }
    if (!emailContent.trim()) {
      toaster.danger(gettext('Please enter the email content before sending'));
      return;
    }
    if (areArraysEqual(emailTo, initialEmailTo || []) && areArraysEqual(emailCC, initialEmailCC || []) && subject === defaultSubject && emailContent === initValue) {
      toaster.danger(gettext('Please modify the recipients or email content before sending'));
      return;
    }

    setIsSubmitting(true);
    onSubmit({
      to: emailTo,
      cc: emailCC,
      subject,
      content: emailContent,
    }, (error) => {
      if (error) {
        setIsSubmitting(false);
        return;
      }
      onToggle();
    });
  }, [emailContent, initialEmailCC, initialEmailTo, initValue, subject, defaultSubject, onToggle, onSubmit]);

  return (
    <div className="seaqa-email-replay-container">
      <div className="seaqa-email-replay-header">
        <div className="seaqa-email-replay-header-title">
          <Icon symbol="email-filled" className="seaqa-email-replay-header-icon" aria-hidden="true" />
          <span>{gettext('New email')}</span>
        </div>
        <button type="button" className="seaqa-email-replay-header-send-btn" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (<Loading />) : gettext('Send')}
        </button>
      </div>
      <div className="seaqa-email-replay-to">
        <div className="seaqa-email-replay-to-title">
          {gettext('From')}
        </div>
        <div className="seaqa-email-replay-static-value text-truncate" title={emailFrom}>{emailFrom || '-'}</div>
      </div>
      <div className="seaqa-email-replay-to">
        <div className="seaqa-email-replay-to-title">
          {gettext('To')}
        </div>
        <SendTo ref={emailToRef} value={initialEmailTo || []}/>
      </div>
      <div className="seaqa-email-replay-to">
        <div className="seaqa-email-replay-to-title">
          {gettext('Cc')}
        </div>
        <SendTo ref={emailCCRef} value={initialEmailCC || []}/>
      </div>
      <div className="seaqa-email-replay-to">
        <div className="seaqa-email-replay-to-title">
          {gettext('Subject')}
        </div>
        <Input
          className="seaqa-email-replay-subject-input"
          value={subject}
          placeholder={gettext('Enter subject')}
          onChange={(event) => setSubject(event.target.value)}
        />
      </div>
      <SeaEmailEditor
        value={emailContent}
        isHtmlValue={isHtmlValue}
        assetURLPrefix={assetURLPrefix}
        onChange={onReplyChange}
      />
      <div className="seaqa-email-replay-attachments">
        <span className="seaqa-email-replay-attachments-plus" aria-hidden="true">+</span>
        <span>{gettext('No attachments')}</span>
      </div>
      <div className="seaqa-email-replay-op-btns">
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? (<Loading />) : (<>{gettext('Send')}</>)}
        </Button>
      </div>
    </div>
  );
};

export default ReplyEmail;
