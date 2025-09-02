import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonGroup, } from 'reactstrap';
import { TICKET_STATUS, TICKET_STATUS_CONFIG } from '../../../constants';
import { Icon, OptionEditor } from '@/components';

import './index.css';

const BTNS = {
  [TICKET_STATUS.OPEN]: [
    TICKET_STATUS_CONFIG[TICKET_STATUS.COMPLETED],
    TICKET_STATUS_CONFIG[TICKET_STATUS.NOT_PLANNED],
    TICKET_STATUS_CONFIG[TICKET_STATUS.DUPLICATE],
  ],
  [TICKET_STATUS.COMPLETED]: [
    TICKET_STATUS_CONFIG[TICKET_STATUS.REOPEN],
    TICKET_STATUS_CONFIG[TICKET_STATUS.NOT_PLANNED],
    TICKET_STATUS_CONFIG[TICKET_STATUS.DUPLICATE],
  ],
  [TICKET_STATUS.NOT_PLANNED]: [
    TICKET_STATUS_CONFIG[TICKET_STATUS.REOPEN],
    TICKET_STATUS_CONFIG[TICKET_STATUS.COMPLETED],
    TICKET_STATUS_CONFIG[TICKET_STATUS.DUPLICATE],
  ],
  [TICKET_STATUS.DUPLICATE]: [
    TICKET_STATUS_CONFIG[TICKET_STATUS.REOPEN],
    TICKET_STATUS_CONFIG[TICKET_STATUS.NOT_PLANNED],
  ],
};

const getOptions = (status) => {
  const _options = BTNS[status] || [];
  return _options.map(option => {
    const { icon, name, description } = option;
    return {
      ...option,
      label: (
        <>
          <Icon symbol={icon} className={`sea-qa-project-ticket-status-option-icon sea-qa-project-ticket-status-${icon}-icon`} />
          <div className="sea-qa-project-ticket-status-option-content">
            <div className="sea-qa-project-ticket-status-option-name">{name}</div>
            {description && (<div className="sea-qa-project-ticket-status-option-description">{description}</div>)}
          </div>
        </>
      ),
    };
  });
};

const StatusToggleButton = ({ status: oldStatus, onChange }) => {
  const [status, setStatus] = useState(BTNS[oldStatus][0].value);
  const [isShowPopover, setIsShowPopover] = useState(false);
  const downBtn = useRef(null);
  const options = useRef(getOptions(oldStatus));

  const openPopover = useCallback(() => {
    setIsShowPopover(true);
  }, []);

  const closePopover = useCallback(() => {
    setIsShowPopover(false);
  }, []);

  const onStatusChange = useCallback(() => {
    onChange(status === TICKET_STATUS.REOPEN ? TICKET_STATUS.OPEN : status);
  }, [status, onChange]);

  const onLocalStatusChange = useCallback((newStatus) => {
    if (!newStatus) {
      setStatus(status);
      return;
    }
    setStatus(newStatus);
  }, [status]);

  useEffect(() => {
    options.current = getOptions(oldStatus);
    setStatus(options.current[0].value);
  }, [oldStatus]);

  const statusOption = options.current.find(o => o.value === status);

  return (
    <>
      <ButtonGroup className="mr-4">
        <Button className="sea-qa-project-ticket-status-toggle-btn d-flex align-items-center" onClick={onStatusChange}>
          <Icon symbol={statusOption?.icon} className={`mr-2 sea-qa-project-ticket-status-${statusOption?.icon}-icon`} />
          <span>{statusOption?.shortName}</span>
        </Button>
        <Button className="sea-qa-project-ticket-status-toggle-btn" innerRef={downBtn} onClick={openPopover}>
          <Icon symbol="down" />
        </Button>
      </ButtonGroup>
      {isShowPopover && (
        <OptionEditor
          target={downBtn}
          className="sea-qa-project-ticket-status-toggle-popover"
          value={status}
          options={options.current}
          onToggle={closePopover}
          onChange={onLocalStatusChange}
        />
      )}
    </>
  );
};

export default StatusToggleButton;
