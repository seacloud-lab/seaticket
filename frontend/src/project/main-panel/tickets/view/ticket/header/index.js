import React, { forwardRef, useCallback, useEffect, useState, useImperativeHandle, useRef } from 'react';
import { Button, Input, Dropdown, DropdownToggle, DropdownItem } from 'reactstrap';
import classnames from 'classnames';
import { IconButton, toaster, Icon, Option, CustomizeDropdownMenu } from '@/components';
import { gettext } from '@/constants';
import { isEnter, isEsc } from '@/utils/hotkey';
import { TICKET_STATE } from '../../../constants';

import './index.css';

const Header = forwardRef(({
  readonly = true,
  className,
  title: propsTitle,
  id,
  stateOption,
  typeOption,
  createMoreOptions,
  modifyTitle,
}, ref) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [title, setTitle] = useState(propsTitle);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const domRef = useRef(null);

  const handleCancelModify = useCallback(() => {
    setTitle(propsTitle);
    setIsRenaming(false);
  }, [propsTitle]);

  const handleModify = useCallback(() => {
    const validTitle = title.trim();
    if (!validTitle) {
      toaster.danger(gettext('Title is required'));
      return;
    }
    if (propsTitle === validTitle) {
      setIsRenaming(false);
      return;
    }
    modifyTitle(validTitle, (error) => {
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
  const statusClassNameMap = {
    [TICKET_STATE.OPEN]: 'open',
    [TICKET_STATE.COMPLETED]: 'completed',
    [TICKET_STATE.NOT_PLANNED]: 'not_planned',
    [TICKET_STATE.DUPLICATE]: 'duplicate',
  };
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
          ) : createMoreOptions ? (
            <Dropdown className="ticket-create-more-options-dropdown" isOpen={isMoreMenuOpen} toggle={() => setIsMoreMenuOpen(!isMoreMenuOpen)}>
              <DropdownToggle tag="span">
                <IconButton className="more-btn" icon="more" title={gettext('More')}/>
              </DropdownToggle>
              <CustomizeDropdownMenu>
                {createMoreOptions().map((option, index) => {
                  if (option === 'Divider') {
                    return <DropdownItem key={index} divider />;
                  }
                  return (
                    <DropdownItem key={option.key || index} onClick={() => { option.callback && option.callback(); setIsMoreMenuOpen(false); }}>
                      {option.label}
                    </DropdownItem>
                  );
                })}
              </CustomizeDropdownMenu>
            </Dropdown>
          ) : null}
        </div>
      </div>
      <div className="sea-qa-project-ticket-state-wrapper">
        <div className={classnames('sea-qa-project-ticket-status', statusClassNameMap[stateOption?.value])}>
          <Icon symbol={stateOption?.icon} />
          <span>{stateOption?.statusName}</span>
        </div>
        {typeOption && (<Option className="ml-2" option={typeOption} />)}
      </div>
    </div>
  );
});

export default Header;
