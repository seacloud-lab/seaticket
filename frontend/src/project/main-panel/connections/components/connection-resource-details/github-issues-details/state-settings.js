import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor, CustomizeLabel } from '@/components';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { isEsc, isS, isShiftS } from '@/utils/hotkey';
import { getColumnOptions, getOption } from '@/sea-metadata/utils/column';
import { GITHUB_STATE_OPTION_NAME_MAP, GITHUB_STATE_REASON_NAME_MAP } from '../../../constants';

import '@/project/main-panel/tickets/components/ticket-settings/state-settings/index.css';

const StateSettings = ({
  isReadonly,
  state: propsState,
  stateColumn,
  stateReason: propsStateReason,
  stateReasonColumn,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const editorRef = useRef(null);

  const stateOptions = useMemo(() => {
    return getColumnOptions(stateColumn).map(o => ({ ...o, display_name: GITHUB_STATE_OPTION_NAME_MAP[o.name] }));
  }, [stateColumn]);
  const stateReasonOptions = useMemo(() => {
    let options = getColumnOptions(stateReasonColumn);
    const openOption = getOption(stateOptions, 'open');
    const closedOption = getOption(stateOptions, 'closed');
    return options.map(o => {
      if (o.name === 'reopened') return { ...o, parent_id: openOption?.id, display_name: GITHUB_STATE_REASON_NAME_MAP[o.name] };
      return { ...o, parent_id: closedOption?.id, display_name: GITHUB_STATE_REASON_NAME_MAP[o.name] };
    });
  }, [stateOptions, stateReasonColumn]);

  const state = useMemo(() => {
    const stateOption = getOption(stateOptions, propsState);
    return stateOption?.id;
  }, [propsState, stateOptions]);

  const stateReason = useMemo(() => {
    const stateOption = getOption(stateReasonOptions, propsStateReason);
    return stateOption?.id;
  }, [propsStateReason, stateReasonOptions]);

  const options = useMemo(() => {
    const currentStateOption = stateOptions.find(o => o.id === state);
    const otherStateOption = stateOptions.find(o => o.id !== state);
    const currentStateReason = stateReasonOptions.filter(r => r.parent_id === state);
    const otherStateReason = stateReasonOptions.filter(r => r.parent_id !== state);
    const currentStateReasonOptions = currentStateReason.map((substate) => {
      return {
        value: currentStateOption.id + '__' + substate.id,
        label: (
          <div>
            <Option option={currentStateOption} />
            <span className="mx-2">{'-'}</span>
            <Option option={substate} />
          </div>
        )
      };
    });
    const otherSubstateOptions = otherStateReason.map((substate) => {
      return {
        value: otherStateOption.id + '__' + substate.id,
        label: (
          <div>
            <Option option={otherStateOption} />
            <span className="mx-2">{'-'}</span>
            <Option option={substate} />
          </div>
        )
      };
    });
    return [...otherSubstateOptions, ...currentStateReasonOptions];
  }, [state, stateOptions, stateReasonOptions]);

  const openEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onStateChange = useCallback((value) => {
    if (!value) return;
    const [state, state_reason] = value.split('__');
    const stateOption = getOption(stateOptions, state);
    const stateReasonOption = getOption(stateReasonOptions, state_reason);
    onChange && onChange({ state: stateOption?.name, state_reason: stateReasonOption?.name });
  }, [onChange, stateOptions, stateReasonOptions]);

  const onHotKey = useCallback((event) => {
    if (isInputOrEditorActive() || isActiveOtherPopover('state-editor-popover')) return;

    if (isS(event) && !isShiftS(event)) {
      openEditor();
    } else if (isEsc(event)) {
      closeEditor();
    }
  }, [openEditor, closeEditor]);

  useEffect(() => {
    document.addEventListener('keydown', onHotKey, true);
    return () => {
      document.removeEventListener('keydown', onHotKey, true);
    };
  }, [onHotKey]);

  const stateOption = stateOptions.find(o => o.id === state);

  return (
    <>
      <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
        <CustomizeLabel icon="single-select">
          {gettext('State')}
        </CustomizeLabel>
        <div className={classnames('ticket-state-formatter', { 'valid': stateOption })} onClick={openEditor} ref={editorRef}>
          {stateOption && (<Option option={stateOption} />)}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <OptionEditor
          id="state-editor-popover"
          className="popover-radius-4 sea-ticket-settings-popover sea-ticket-state-settings-popover"
          target={editorRef}
          sameWidthWithTarget={240}
          isMultiple={false}
          isSearchEnabled={false}
          value={`${state}__${stateReason}`}
          options={options}
          onChange={onStateChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default StateSettings;
