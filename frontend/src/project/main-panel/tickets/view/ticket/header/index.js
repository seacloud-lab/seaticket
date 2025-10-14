import React, { forwardRef, useCallback, useEffect, useState, useImperativeHandle, useRef } from 'react';
import { Button, Input } from 'reactstrap';
import classnames from 'classnames';
import { IconButton, toaster, Icon, Option } from '@/components';
import { gettext } from '@/constants';
import { isEnter, isEsc } from '@/utils/hotkey';
import { validateTitle } from '@/utils/validate';

import './index.css';

const Header = forwardRef(({
  readonly = true,
  className,
  title: propsTitle,
  id,
  statusOption,
  typeOption,
  copyLink,
  modifyTitle,
}, ref) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [title, setTitle] = useState(propsTitle);

  const domRef = useRef(null);

  const handleCancelModify = useCallback(() => {
    setTitle(propsTitle);
    setIsRenaming(false);
  }, [propsTitle]);

  const handleModify = useCallback(() => {
    const { isValid, message } = validateTitle(title);
    if (!isValid) {
      toaster.danger(message);
      return;
    }
    if (propsTitle === message) {
      setIsRenaming(false);
      return;
    }
    modifyTitle(message, (error) => {
      if (!error) {
        setIsRenaming(false);
      }
    });
  }, [title, propsTitle, modifyTitle]);

  const onChange = useCallback((event) => {
    const newTitle = event.target.value;
    if (newTitle === title) return;
    setTitle(newTitle);
  }, [title]);

  const onKeyDown = useCallback((event) => {
    if (isEsc(event)) {
      handleCancelModify();
    }
    if (isEnter(event)) {
      handleModify();
    }
  }, [handleCancelModify, handleModify]);

  useEffect(() => {
    if (!readonly) return;
    setTitle(propsTitle);
  }, [readonly, propsTitle]);

  useImperativeHandle(ref, () => ({
    getDom: () => domRef.current,
  }), [domRef]);

  return (
    <div className={classnames('sea-qa-project-ticket-header', className)} ref={domRef}>
      <div className="sea-qa-project-ticket-title-wrapper">
        <div className={classnames('sea-qa-project-ticket-title-wrapper-left', { 'o-hidden': !isRenaming })}>
          <div className={classnames('sea-qa-project-ticket-title-number', { 'w-100': isRenaming, 'o-hidden': !isRenaming })}>
            {isRenaming ? (
              <Input value={title} autoFocus={true} className="sea-qa-project-ticket-title-input" onChange={onChange} onKeyDown={onKeyDown} />
            ) : (
              <>
                <span title={title} className="sea-qa-project-ticket-title">{title}</span>
                <span className="sea-qa-project-ticket-number">{`#${id}`}</span>
              </>
            )}
            {!readonly && !isRenaming && (
              <IconButton icon="rename" className="sea-qa-project-ticket-rename-btn" onClick={() => setIsRenaming(true)} />
            )}
          </div>
        </div>
        <div className="sea-qa-project-ticket-title-wrapper-right">
          {isRenaming ? (
            <>
              <Button className="sea-qa-project-ticket-title-cancel-btn" onClick={handleCancelModify}>
                {gettext('Cancel')}
              </Button>
              <Button className="sea-qa-project-ticket-title-submit-btn" color="primary" onClick={handleModify}>
                {gettext('Submit')}
              </Button>
            </>
          ) : (
            <IconButton icon="copy" className="sea-qa-project-ticket-copy" onClick={copyLink} />
          )}
        </div>
      </div>
      <div className="sea-qa-project-ticket-status-wrapper">
        <div className={classnames('sea-qa-project-ticket-status', statusOption?.value)}>
          <Icon symbol={statusOption?.icon} />
          <span>{statusOption?.statusName}</span>
        </div>
        {typeOption && (<Option className="ml-2" option={typeOption} />)}
      </div>
    </div>
  );
});

export default Header;
