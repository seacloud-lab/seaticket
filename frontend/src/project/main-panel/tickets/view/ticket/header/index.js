import React, { forwardRef, useCallback, useEffect, useState, useImperativeHandle, useRef } from 'react';
import { Button, Input, Dropdown } from 'reactstrap';
import classnames from 'classnames';
import {
  IconButton, toaster, Icon, Option,
  CustomizeDropdownMoreToggle, CustomizeDropdownMenu, CustomizeDropdownItem
} from '@/components';
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
    <div className={classnames('seaqa-project-ticket-header', className)} ref={domRef}>
      <div className="seaqa-project-ticket-title-wrapper">
        <div className={classnames('seaqa-project-ticket-title-wrapper-left', { 'o-hidden': !isRenaming })}>
          <div className={classnames('seaqa-project-ticket-title-number', { 'w-100': isRenaming, 'o-hidden': !isRenaming })}>
            {isRenaming ? (
              <Input value={title} autoFocus={true} className="seaqa-project-ticket-title-input" onChange={onChange} onKeyDown={onKeyDown} />
            ) : (
              <>
                <span title={title} className="seaqa-project-ticket-title">{title}</span>
                <span className="seaqa-project-ticket-number">{`#${id}`}</span>
              </>
            )}
            {!readonly && !isRenaming && (
              <IconButton icon="rename" className="seaqa-project-ticket-rename-btn" onClick={() => setIsRenaming(true)} />
            )}
          </div>
        </div>
        <div className="seaqa-project-ticket-title-wrapper-right">
          {isRenaming ? (
            <>
              <Button className="seaqa-project-ticket-title-cancel-btn" onClick={handleCancelModify}>
                {gettext('Cancel')}
              </Button>
              <Button className="seaqa-project-ticket-title-submit-btn" color="primary" onClick={handleModify}>
                {gettext('Submit')}
              </Button>
            </>
          ) : createMoreOptions ? (
            <Dropdown isOpen={isMoreMenuOpen} toggle={() => setIsMoreMenuOpen(!isMoreMenuOpen)}>
              <CustomizeDropdownMoreToggle isOpen={isMoreMenuOpen} title={gettext('More')} />
              <CustomizeDropdownMenu className="position-fixed">
                {createMoreOptions().map((option, index) => {
                  if (option === 'Divider') {
                    return <CustomizeDropdownItem key={index} divider />;
                  }
                  return (
                    <CustomizeDropdownItem key={option.key || index} onClick={() => { option.callback && option.callback(); setIsMoreMenuOpen(false); }}>
                      {option.label}
                    </CustomizeDropdownItem>
                  );
                })}
              </CustomizeDropdownMenu>
            </Dropdown>
          ) : null}
        </div>
      </div>
      <div className="seaqa-project-ticket-state-wrapper">
        <div className={classnames('seaqa-project-ticket-status', statusClassNameMap[stateOption?.value])}>
          <Icon symbol={stateOption?.icon} />
          <span>{stateOption?.statusName}</span>
        </div>
        {typeOption && (<Option className="ml-2" option={typeOption} />)}
      </div>
    </div>
  );
});

export default Header;
