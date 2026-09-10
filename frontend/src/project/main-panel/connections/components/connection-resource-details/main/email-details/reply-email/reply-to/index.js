import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Input } from 'reactstrap';
import classnames from 'classnames';
import { ClickOutside, IconButton, IconTooltip } from '@/components';
import { gettext } from '@/constants';
import { isString } from '@/utils/type-detection';
import { isValidEmail } from '@/utils/validate';

import './index.css';

const ReplyTo = ({
  isExpand = true,
  title,
  value,
  size = 'l',
  readonly = false,
  className,
  onChange,
}, ref) => {
  const [focus, setFocus] = useState(false);
  const [email, setEmail] = useState('');
  const [emails, setEmails] = useState(Array.isArray(value) ? value.filter(email => email && isString(email)) : []);

  useEffect(() => {
    const nextEmails = Array.isArray(value) ? value.filter(email => email && isString(email)) : [];
    setEmails(nextEmails);
  }, [value]);

  const handleRemove = useCallback((emailToRemove) => {
    const newEmails = emails.filter(item => item !== emailToRemove);
    setEmails(newEmails);
    onChange && onChange(newEmails);
  }, [emails, onChange]);

  const onEmailChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === email) return;
    if (newValue.endsWith(',') || newValue.endsWith('，')) {
      const newEmail = newValue.slice(0, -1).trim();
      if (!newEmail || emails.includes(newEmail)) {
        setEmail('');
        return;
      }
      const newEmails = [...emails, newEmail];
      setEmails(newEmails);
      setEmail('');
      onChange && onChange(newEmails);
      return;
    }
    setEmail(newValue);
  }, [email, emails, onChange]);

  const formatToEmail = useCallback(() => {
    const newEmail = email.trim();
    if (!newEmail || emails.includes(newEmail)) {
      setEmail('');
      return emails;
    }

    const newEmails = [...emails, newEmail];
    setEmails(newEmails);
    setEmail('');
    onChange && onChange(newEmails);
    return newEmails;
  }, [email, emails, onChange]);

  useImperativeHandle(ref, () => ({
    getValue: formatToEmail,
  }), [formatToEmail]);

  const isShowExpandBtn = !isExpand && !focus && emails.length > 1;

  return (
    <ClickOutside onClickOutside={() => setFocus(false)}>
      <div className={classnames('seaqa-email-reply-to', className, size, { 'focus': focus, 'readonly': readonly })}>
        <div className="seaqa-email-reply-to-title text-truncate" title={title}>
          {title}
        </div>
        <div className={classnames('seaqa-email-reply-to-users', { 'flex-nowrap o-hidden': isShowExpandBtn })}>
          {emails.length > 0 && emails.map(email => {
            return (
              <div className={classnames('seaqa-email-to-user', { 'invalid': !isValidEmail(email) })} key={email}>
                <div className="flex-1 text-truncate">{email}</div>
                {!readonly && (
                  <IconTooltip
                    icon="close"
                    className="mx-0 seaqa-email-to-user-remove-btn"
                    tip={gettext('Remove')}
                    size={{ btn: 20, icon: 12 }}
                    onClick={() => handleRemove(email)}
                    placement="top"
                  />
                )}
              </div>
            );
          })}
          {!readonly && (
            <Input
              className="seaqa-email-to-user-input"
              value={email}
              onChange={onEmailChange}
              onFocus={() => setFocus(true)}
              onBlur={formatToEmail}
            />
          )}
        </div>
        {isShowExpandBtn && (
          <div className="seaqa-email-reply-to-expand-btn-container d-flex align-items-center justify-content-center">
            <IconButton icon="arrow-down-b" onClick={() => setFocus(true)} size={{ icon: 14 }} />
          </div>
        )}
      </div>
    </ClickOutside>
  );
};

export default forwardRef(ReplyTo);
