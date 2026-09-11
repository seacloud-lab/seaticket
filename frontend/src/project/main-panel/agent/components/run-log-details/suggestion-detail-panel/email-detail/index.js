import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Input } from 'reactstrap';
import { gettext } from '@/constants';
import ReplyTo from '@/project/main-panel/connections/components/connection-resource-details/main/email-details/reply-email/reply-to';
import { parseEmailReplySuggestion } from '../../../../utils';

import './index.css';

const EmailDetail = ({ isEdit, isSaving, value, defaultReplyTo, onChange }) => {
  const [email, setEmail] = useState({ to: [], cc: [], content: '' });

  const isReadonly = useMemo(() => !isEdit || isSaving, [isEdit, isSaving]);

  const handleChange = useCallback((update) => {
    const newEmail = { ...email, ...update };
    setEmail(newEmail);
    onChange && onChange(JSON.stringify(newEmail));
  }, [email, onChange]);

  useEffect(() => {
    setEmail(parseEmailReplySuggestion(value, defaultReplyTo));
  }, [value, defaultReplyTo]);

  return (
    <div className="seaqa-suggestion-detail-draft">
      <div className="seaqa-suggestion-detail-draft-title">
        {gettext('Draft')}
      </div>
      <div className="seaqa-suggestion-detail-draft-body gap-2 pt-0">
        <ReplyTo
          isExpand={false}
          title={gettext('To')}
          value={email.to}
          readonly={isReadonly}
          onChange={(emails) => handleChange({ to: emails })}
        />
        <ReplyTo
          isExpand={false}
          title={gettext('Cc')}
          value={email.cc}
          readonly={isReadonly}
          onChange={(emails) => handleChange({ cc: emails })}
        />
        <Input
          className="seaqa-ticket-content mt-2"
          type="textarea"
          value={email.content}
          readOnly={isReadonly}
          onChange={(e) => handleChange({ content: e.target.value })}
        />
      </div>
    </div>
  );
};

export default EmailDetail;
