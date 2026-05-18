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
  isHtmlValue,
  assetURLPrefix,
  onToggle,
  onSubmit,
}) => {
  const [emailTo, setEmailTo] = useState(propsEmailTo || []);
  const [emailCC, setEmailCC] = useState([]);
  const [emailContent, setEmailContent] = useState(initValue || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ableSubmit = useMemo(() => {
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
    setEmailContent(value);
  }, [emailContent]);

  const handleSubmit = useCallback(() => {
    if (!ableSubmit) return;
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
  }, [ableSubmit, emailTo, emailCC, emailContent, onToggle, onSubmit]);

  return (
    <div className="seaqa-email-replay-container">
      <div className="seaqa-email-replay-to">
        <div className="seaqa-email-replay-to-title">
          {gettext('To')}
        </div>
        <SendTo value={emailTo} onChange={onEmailToChange}/>
      </div>
      <div className="seaqa-email-replay-to">
        <div className="seaqa-email-replay-to-title">
          {gettext('Copy to')}
        </div>
        <SendTo value={emailCC} onChange={onEmailCCChange}/>
      </div>
      <SeaEmailEditor
        value={emailContent}
        isHtmlValue={isHtmlValue}
        assetURLPrefix={assetURLPrefix}
        onChange={onReplyChange}
      />
      <div className="seaqa-email-replay-op-btns">
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={!ableSubmit} onClick={handleSubmit}>
          {isSubmitting ? (<Loading />) : (<>{gettext('Submit')}</>)}
        </Button>
      </div>
    </div>
  );
};

export default ReplyEmail;
