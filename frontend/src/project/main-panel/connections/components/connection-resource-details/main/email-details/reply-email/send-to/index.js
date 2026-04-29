import React, { useCallback, useMemo, useState } from 'react';
import classnames from 'classnames';
import { Input } from 'reactstrap';
import { ClickOutside, IconTooltip } from '@/components';
import { gettext } from '@/constants';
import { isString } from '@/utils/type-detection';

import './index.css';

const SendTo = ({
  value: propsValue = [],
  readonly = false,
  className,
  onChange,
}) => {
  const [focus, setFocus] = useState(false);
  const [email, setEmail] = useState('');
  const value = useMemo(() => {
    if (!Array.isArray(propsValue) || propsValue.length === 0) return [];
    return propsValue.filter(email => email && isString(email));
  }, [propsValue]);

  const handleRemove = useCallback((email) => {
    const newValue = value.filter(item => item !== email);
    onChange(newValue);
  }, [value, onChange]);

  const onEmailChange = useCallback((event) => {
    const newValue = event.target.value;
    if (newValue === email) return;
    if (newValue.endsWith(',') || newValue.endsWith('，')) {
      const newEmail = newValue.slice(0, -1).trim();
      if (!newEmail || value.includes(newEmail)) return;
      const newEmails = [...value, newEmail];
      onChange(newEmails);
      setEmail('');
      return;
    }
    setEmail(newValue);
  }, [email, value, onChange]);

  return (
    <ClickOutside onClickOutside={() => setFocus(false)}>
      <div className={classnames('sea-ticket-email-to-container', className, { 'focus': focus })}>
        {value.length > 0 && (
          <div className="sea-ticket-email-to-value">
            {value.map(email => {
              return (
                <div className="sea-ticket-email-to-user" key={email}>
                  <div className="sea-ticket-email-to-user-email">{email}</div>
                  {!readonly && (
                    <IconTooltip
                      hoverBackground={true}
                      icon="close"
                      className="mr-0 sea-ticket-email-to-user-remove-btn"
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
            className="sea-ticket-email-to-user-input"
            value={email}
            onChange={onEmailChange}
            onFocus={() => setFocus(true)}
          />
        )}
      </div>
    </ClickOutside>
  );
};

export default SendTo;
