import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ButtonGroup, } from 'reactstrap';
import { TICKET_STATE } from '../../../constants';
import { Icon, OptionEditor } from '@/components';
import { useMetadata } from '../../../hooks';
import { gettext } from '@/constants';

import './index.css';

const StatusToggleButton = ({ state: oldState, substate: oldSubState, disabled, comment, onChange }) => {
  const [state, setState] = useState('');
  const [substate, setSubState] = useState('');
  const [isShowPopover, setIsShowPopover] = useState(false);
  const downBtn = useRef(null);

  const { substatesData } = useMetadata();

  const openOptions = useMemo(() => {
    return substatesData.rows
      .filter(r => r.parent_id && r.parent_id === TICKET_STATE.OPEN)
      .map(subState => {
        const { parent_id, description, _id, name } = subState;
        return {
          value: `${parent_id}--${_id}`,
          icon: 'dot-circle-stroked',
          description,
          name,
          state: parent_id,
          subState: _id,
        };
      });
  }, [substatesData]);

  const closeOptions = useMemo(() => {
    return substatesData.rows
      .filter(r => r.parent_id && r.parent_id === TICKET_STATE.CLOSED)
      .map(subState => {
        const { parent_id, description, _id, name } = subState;
        return {
          value: `${parent_id}--${_id}`,
          icon: 'check-circle-stroked',
          description,
          name,
          state: parent_id,
          subState: _id,
        };
      });
  }, [substatesData]);

  const options = useMemo(() => {
    let _options = oldState === TICKET_STATE.OPEN ? [...closeOptions, ...openOptions] : [...openOptions, ...closeOptions];
    return _options
      .filter(o => o.value !== `${oldState}--${oldSubState}`)
      .map(option => {
        const { state, description, icon, value } = option;
        let name = '';
        if (state === TICKET_STATE.CLOSED) {
          name = gettext('Close as %s').replace('%s', option.name.toLowerCase());
        } else {
          if (oldState === TICKET_STATE.CLOSED) {
            name = gettext('Reopen as %s').replace('%s', option.name.toLowerCase());
          } else {
            name = gettext('Open as %s').replace('%s', option.name.toLowerCase());
          }
        }
        return {
          value,
          icon,
          name,
          label: (
            <>
              <Icon symbol={icon} className={`sea-qa-project-ticket-state-option-icon sea-qa-project-ticket-state-${icon}-icon`} />
              <div className="sea-qa-project-ticket-state-option-content">
                <div className="sea-qa-project-ticket-state-option-name">{name}</div>
                {description && (<div className="sea-qa-project-ticket-state-option-description">{description}</div>)}
              </div>
            </>
          )
        };
      });
  }, [oldState, oldSubState, openOptions, closeOptions]);

  const icon = useMemo(() => {
    return state === TICKET_STATE.OPEN ? 'dot-circle-stroked' : 'check-circle-stroked';
  }, [state]);

  const name = useMemo(() => {
    const option = options.find(o => o.value === `${state}--${substate}`);
    if (!comment) return option?.name;
    if (state === TICKET_STATE.CLOSED) return gettext('Close with comment');
    return oldState === TICKET_STATE.CLOSED ? gettext('Reopen with comment') : gettext('Open with comment');
  }, [options, state, substate, comment]);

  const openPopover = useCallback(() => {
    setIsShowPopover(true);
  }, []);

  const closePopover = useCallback(() => {
    setIsShowPopover(false);
  }, []);

  const handleChange = useCallback(() => {
    onChange && onChange(state, substate);
  }, [state, substate, onChange]);

  const handleLocalChange = useCallback((newValue) => {
    if (!newValue) return;
    const [newState, newSubState] = newValue.split('--');
    if (newState !== state) {
      setState(newState);
    }
    if (newSubState !== substate) {
      setSubState(newSubState);
    }
  }, [state, substate]);

  useEffect(() => {
    const state = oldState === TICKET_STATE.OPEN ? TICKET_STATE.CLOSED : TICKET_STATE.OPEN;
    const options = oldState === TICKET_STATE.OPEN ? closeOptions : openOptions;
    setState(state);
    setSubState(options[0]?.subState);
  }, [oldState, oldSubState, substatesData, openOptions, closeOptions]);

  return (
    <>
      <ButtonGroup className="mr-4">
        <Button className="sea-qa-project-ticket-state-toggle-btn d-flex align-items-center" disabled={disabled} onClick={handleChange}>
          <Icon symbol={icon} className={`mr-2 sea-qa-project-ticket-state-${icon}-icon`} />
          <span>{name}</span>
        </Button>
        <Button className="sea-qa-project-ticket-state-toggle-btn" innerRef={downBtn} onClick={openPopover}>
          <Icon symbol="arrow-down" />
        </Button>
      </ButtonGroup>
      {isShowPopover && (
        <OptionEditor
          target={downBtn}
          className="sea-qa-project-ticket-state-toggle-popover"
          value={`${state}--${substate}`}
          options={options}
          onToggle={closePopover}
          onChange={handleLocalChange}
        />
      )}
    </>
  );
};

export default StatusToggleButton;
