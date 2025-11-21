import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonGroup, } from 'reactstrap';
import { TICKET_STATE, TICKET_STATE_CONFIG } from '../../../constants';
import { Icon, OptionEditor } from '@/components';

import './index.css';

const BTNS = {
  [TICKET_STATE.OPEN]: [
    TICKET_STATE_CONFIG[TICKET_STATE.CLOSED]
  ],
  [TICKET_STATE.CLOSED]: [
    TICKET_STATE_CONFIG[TICKET_STATE.OPEN],
  ]
};

const getOptions = (state) => {
  const _options = BTNS[state] || [];
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

const StatusToggleButton = ({ state: oldState, disabled, onChange }) => {
  const [state, setStatus] = useState(BTNS[oldState][0].value);
  const [isShowPopover, setIsShowPopover] = useState(false);
  const downBtn = useRef(null);
  const options = useRef(getOptions(oldState));

  const openPopover = useCallback(() => {
    setIsShowPopover(true);
  }, []);

  const closePopover = useCallback(() => {
    setIsShowPopover(false);
  }, []);

  const onStatusChange = useCallback(() => {
    onChange(state === TICKET_STATE.REOPEN ? TICKET_STATE.OPEN : state);
  }, [state, onChange]);

  const onLocalStatusChange = useCallback((newStatus) => {
    if (!newStatus) {
      setStatus(state);
      return;
    }
    setStatus(newStatus);
  }, [state]);

  useEffect(() => {
    options.current = getOptions(oldState);
    setStatus(options.current[0].value);
  }, [oldState]);

  const stateOption = options.current.find(o => o.value === state);

  return (
    <>
      <ButtonGroup className="mr-4">
        <Button className="sea-qa-project-ticket-status-toggle-btn d-flex align-items-center" disabled={disabled} onClick={onStatusChange}>
          <Icon symbol={stateOption?.icon} className={`mr-2 sea-qa-project-ticket-status-${stateOption?.icon}-icon`} />
          <span>{stateOption?.shortName}</span>
        </Button>
        <Button className="sea-qa-project-ticket-status-toggle-btn" innerRef={downBtn} onClick={openPopover}>
          <Icon symbol="down" />
        </Button>
      </ButtonGroup>
      {isShowPopover && (
        <OptionEditor
          target={downBtn}
          className="sea-qa-project-ticket-status-toggle-popover"
          value={state}
          options={options.current}
          onToggle={closePopover}
          onChange={onLocalStatusChange}
        />
      )}
    </>
  );
};

export default StatusToggleButton;
