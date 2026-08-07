import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import classnames from 'classnames';
import { Input } from 'reactstrap';
import { ClickOutside, IconTooltip } from '@/components';
import { gettext } from '@/constants';
import { isString } from '@/utils/type-detection';
import { isValidEmail } from '@/utils/validate';

import './index.css';

const SendTo = ({
  value,
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

  return (
    <ClickOutside onClickOutside={() => setFocus(false)}>
      <div className={classnames('seaqa-email-to-container', className, { 'focus': focus })}>
        {emails.length > 0 && (
          <div className="seaqa-email-to-value">
            {emails.map(email => {
              return (
                <div className={classnames('seaqa-email-to-user', { 'invalid': !isValidEmail(email) })} key={email}>
                  <div className="seaqa-email-to-user-email">{email}</div>
                  {!readonly && (
                    <IconTooltip
                      hoverBackground={true}
                      icon="close"
                      className="mr-0 seaqa-email-to-user-remove-btn"
                      tip={gettext('Remove')}
                      size={{ btn: 20, icon: 12 }}
                      onClick={() => handleRemove(email)}
                      placement="top"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
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
    </ClickOutside>
  );
};

export default forwardRef(SendTo);
