import React, { useCallback, useMemo, useState } from 'react';
import SeaEmailEditor from '@seafile/sea-email-editor';
import { Button } from 'reactstrap';
import { gettext } from '@/constants';
import SendTo from './send-to';
import { Loading } from '@/components';

import './index.css';

const ReplyEmail = ({
  emailTo: propsEmailTo,
  initValue,
  onToggle,
  onSubmit,
}) => {
  const [emailTo, setEmailTo] = useState(propsEmailTo || []);
  const [emailCC, setEmailCC] = useState([]);
  const [emailContent, setEmailContent] = useState(initValue || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ableSubmitting = useMemo(() => {
    if (emailTo.length === 0 || !emailContent || isSubmitting || initValue === emailContent) return false;
    return true;
  }, [emailTo, emailContent, initValue, isSubmitting]);

  const onEmailToChange = useCallback((value) => {
    setEmailTo(value);
  }, []);

  const onEmailCCChange = useCallback((value) => {
    setEmailCC(value);
  }, []);

  const onReplyChange = useCallback((value) => {
    if (value === emailContent) return;
    console.log(value);
    setEmailContent(value);
  }, [emailContent]);

  const handleSubmit = useCallback(() => {
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
  }, [emailTo, emailCC, emailContent, onToggle, onSubmit]);

  return (
    <div className="sea-ticket-email-replay-container">
      <div className="sea-ticket-email-replay-to">
        <div className="sea-ticket-email-replay-to-title">
          {gettext('To')}
        </div>
        <SendTo value={emailTo} onChange={onEmailToChange}/>
      </div>
      <div className="sea-ticket-email-replay-to">
        <div className="sea-ticket-email-replay-to-title">
          {gettext('Copy to')}
        </div>
        <SendTo value={emailCC} onChange={onEmailCCChange}/>
      </div>
      <SeaEmailEditor
        value={emailContent}
        onChange={onReplyChange}
      />
      <div className="sea-ticket-email-replay-op-btns">
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={!ableSubmitting} onClick={handleSubmit}>
          {isSubmitting ? (<Loading />) : (<>{gettext('Submit')}</>)}
        </Button>
      </div>
    </div>
  );
};

export default ReplyEmail;
