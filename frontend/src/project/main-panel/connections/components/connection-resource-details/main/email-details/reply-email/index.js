import React, { useCallback, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import SeaEmailEditor from '@seafile/sea-email-editor';
import { Icon, IconTooltip, Loading, toaster } from '@/components';
import { gettext } from '@/constants';
import { areArraysEqual } from '@/utils/array-utils';
import { isValidEmail } from '@/utils/validate';
import ReplyTo from './reply-to';

import './index.css';

const ReplyEmail = ({
  emailTo: initialEmailTo,
  emailCC: initialEmailCC,
  initValue,
  isHtmlValue,
  assetURLPrefix,
  onToggle,
  onSubmit,
}) => {
  const [emailContent, setEmailContent] = useState(initValue || '');
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
    if (areArraysEqual(emailTo, initialEmailTo || []) && areArraysEqual(emailCC, initialEmailCC || []) && emailContent === initValue) {
      toaster.danger(gettext('Please modify the recipients or email content before sending'));
      return;
    }

    setIsSubmitting(true);
    onSubmit({
      to: emailTo,
      cc: emailCC,
      content: emailContent,
    }, (error) => {
      if (error) {
        setIsSubmitting(false);
        return;
      }
      onToggle();
    });
  }, [emailContent, initialEmailCC, initialEmailTo, initValue, onToggle, onSubmit]);

  return (
    <div className="seaqa-email-reply-container">
      <div className="seaqa-email-reply-header">
        <Button color="primary" className="seaqa-email-reply-send-btn" disabled={isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? (<Loading />) : (<Icon symbol="send-stroked" />)}
          {isSubmitting ? gettext('Sending') : gettext('Send')}
        </Button>
        <IconTooltip
          icon="close"
          onClick={onToggle}
          size={{ btn: 24, icon: 16 }}
          hoverBackground={true}
          tip={gettext('Cancel')}
          className="mx-0"
          placement="bottom"
        />
      </div>
      <div className="seaqa-email-reply-body">
        <div className="seaqa-email-reply-to-container">
          <ReplyTo title={gettext('To')} ref={emailToRef} value={initialEmailTo || []} />
          <ReplyTo title={gettext('Cc')} ref={emailCCRef} value={initialEmailCC || []} />
        </div>
        <SeaEmailEditor
          value={emailContent}
          isHtmlValue={isHtmlValue}
          assetURLPrefix={assetURLPrefix}
          onChange={onReplyChange}
        />
      </div>
    </div>
  );
};

export default ReplyEmail;
