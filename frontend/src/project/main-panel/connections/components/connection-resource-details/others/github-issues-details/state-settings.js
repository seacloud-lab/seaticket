import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { Button, ButtonGroup, } from 'reactstrap';
import { gettext } from '@/constants';
import { Option, OptionEditor, CustomizeLabel, Icon } from '@/components';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { isEsc, isS, isShiftS } from '@/utils/hotkey';
import { getColumnOptions, getOption } from '@/sea-metadata/utils/column';
import { GITHUB_STATE_OPTION_NAME_MAP, GITHUB_STATE_REASON_NAME_MAP } from '../../../../constants';

import '@/project/main-panel/tickets/components/ticket-settings/state-settings/index.css';

const StateSettings = ({
  id,
  isReadonly,
  state: propsState,
  stateColumn,
  stateReason: propsStateReason,
  stateReasonColumn,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const [state, setState] = useState('');
  const [stateReason, setStateReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editorRef = useRef(null);

  const stateOptions = useMemo(() => {
    return getColumnOptions(stateColumn).map(o => ({ ...o, display_name: GITHUB_STATE_OPTION_NAME_MAP[o.name] }));
  }, [stateColumn]);
  const openOption = useMemo(() => getOption(stateOptions, 'open'), [stateOptions]);
  const closedOption = useMemo(() => getOption(stateOptions, 'closed'), [stateOptions]);
  const stateReasonOptions = useMemo(() => {
    let options = getColumnOptions(stateReasonColumn);
    return options.map(o => {
      if (o.name === 'reopened') return { ...o, value: `${openOption?.id}__${o.id}`, display_name: GITHUB_STATE_REASON_NAME_MAP[o.name] };
      return { ...o, value: `${closedOption?.id}__${o.id}`, display_name: GITHUB_STATE_REASON_NAME_MAP[o.name] };
    });
  }, [stateReasonColumn, openOption, closedOption]);

  const propStateValue = useMemo(() => {
    const stateOption = getOption(stateOptions, propsState);
    return stateOption?.id;
  }, [propsState, stateOptions]);
  const propStateReasonValue = useMemo(() => {
    const stateOption = getOption(stateReasonOptions, propsStateReason);
    return stateOption?.id;
  }, [propsStateReason, stateReasonOptions]);

  const isClosed = useMemo(() => propStateValue === closedOption?.id, [propStateValue, closedOption]);
  const closeOptions = useMemo(() => {
    return stateReasonOptions.filter(o => o.name !== 'reopened');
  }, [isClosed, stateReasonOptions]);
  const openOptions = useMemo(() => {
    return stateReasonOptions.filter(o => o.name === 'reopened');
  }, [isClosed, stateReasonOptions]);
  const icon = useMemo(() => {
    return isClosed ? 'dot-circle-stroked' : 'check-circle-stroked';
  }, [isClosed]);

  const options = useMemo(() => {
    let _options = propsState === 'open' ? closeOptions : openOptions;
    return _options
      .map(option => {
        const { value, display_name } = option;
        let name = display_name;
        if (!isClosed) {
          name = gettext('Close as %s').replace('%s', display_name.toLowerCase());
        }
        return { value, label: name };
      });
  }, [propsState, propStateValue, propStateReasonValue, isClosed]);

  const openEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const handleChange = useCallback(() => {
    if (isSubmitting) return;
    const stateOption = getOption(stateOptions, state);
    const stateReasonOption = getOption(stateReasonOptions, stateReason);
    setIsSubmitting(true);
    onChange && onChange({ state: stateOption?.name, state_reason: stateReasonOption?.name }, () => {
      setIsSubmitting(false);
    });
  }, [state, stateReason, isSubmitting, onChange]);

  const handleLocalChange = useCallback((newValue) => {
    if (!newValue) return;
    const [newState, newStateReason] = newValue.split('__');
    if (newState !== state) {
      setState(newState);
    }
    if (newStateReason !== stateReason) {
      setStateReason(newStateReason);
    }
  }, [state, stateReason]);

  const onHotKey = useCallback((event) => {
    if (isInputOrEditorActive() || isActiveOtherPopover(id)) return;

    if (isS(event) && !isShiftS(event)) {
      openEditor();
    } else if (isEsc(event)) {
      closeEditor();
    }
  }, [id, openEditor, closeEditor]);

  useEffect(() => {
    document.addEventListener('keydown', onHotKey, true);
    return () => {
      document.removeEventListener('keydown', onHotKey, true);
    };
  }, [onHotKey]);

  useEffect(() => {
    const state = isClosed ? openOption.id : closedOption.id;
    const options = isClosed ? openOptions : closeOptions;
    setState(state);
    setStateReason(options[0].id);
  }, [isClosed, closedOption, openOption, openOptions, closeOptions]);

  const option = options.find(o => o.value === `${state}__${stateReason}`);

  return (
    <>
      <div className={classnames('sea-ticket-settings-item', className)}>
        <CustomizeLabel icon="single-select">
          {gettext('State')}
        </CustomizeLabel>
        <div className={classnames('ticket-state-formatter valid', { 'mb-0': !isReadonly })}>
          <Option option={isClosed ? closedOption : openOption} />
        </div>
        {!isReadonly && (
          <>
            {options.length === 1 ? (
              <Button
                className="sea-qa-project-ticket-state-toggle-btn d-flex align-items-center mb-2 text-truncate mw-100"
                disabled={isSubmitting}
                onClick={handleChange}
              >
                <Icon symbol={icon} className={`mr-2 sea-qa-project-ticket-state-${icon}-icon`} />
                <span className="text-truncate" title={option?.label}>{option?.label}</span>
              </Button>
            ) : (
              <ButtonGroup className="mb-2 mw-100">
                <Button
                  className="sea-qa-project-ticket-state-toggle-btn d-flex align-items-center text-truncate"
                  disabled={isSubmitting}
                  onClick={handleChange}
                >
                  <Icon symbol={icon} className={`mr-2 sea-qa-project-ticket-state-${icon}-icon`} />
                  <span className="text-truncate" title={option?.label}>{option?.label}</span>
                </Button>
                <Button className="sea-qa-project-ticket-state-toggle-btn" innerRef={editorRef} onClick={openEditor}>
                  <Icon symbol="arrow-down" />
                </Button>
              </ButtonGroup>
            )}
          </>
        )}
      </div>
      {!isReadonly && isShowEditor && (
        <OptionEditor
          id={id}
          target={editorRef}
          className="sea-ticket-settings-popover sea-ticket-state-settings-popover"
          sameWidthWithTarget={240}
          isMultiple={false}
          isSearchEnabled={false}
          value={`${state}__${stateReason}`}
          options={options}
          onToggle={closeEditor}
          onChange={handleLocalChange}
        />
      )}
    </>
  );
};

export default StateSettings;
