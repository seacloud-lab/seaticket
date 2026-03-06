import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor, CustomizeLabel } from '@/components';
import { useMetadata } from '../../../hooks';
import { TICKET_STATE_OPTIONS } from '../../../constants';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { isEsc, isS } from '@/utils/hotkey';

import './index.css';

const StateSettings = ({
  isReadonly,
  state,
  substate,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const { isLoading, substatesData } = useMetadata();

  const editorRef = useRef(null);

  const options = useMemo(() => {
    if (isLoading) return [];
    const currentStateOption = TICKET_STATE_OPTIONS.find(o => o.id === state);
    const otherStateOption = TICKET_STATE_OPTIONS.find(o => o.id !== state);
    const currentSubstates = substatesData.rows.filter(r => r.parent_id === state);
    const otherSubstates = substatesData.rows.filter(r => r.parent_id !== state);
    const currentSubstateOptions = currentSubstates.map((substate) => {
      return {
        value: currentStateOption.id + '__' + substate._id,
        label: (
          <div>
            <Option option={currentStateOption} />
            <span className="mx-2">{'-'}</span>
            <Option option={substate} />
          </div>
        )
      };
    });
    const otherSubstateOptions = otherSubstates.map((substate) => {
      return {
        value: otherStateOption.id + '__' + substate._id,
        label: (
          <div>
            <Option option={otherStateOption} />
            <span className="mx-2">{'-'}</span>
            <Option option={substate} />
          </div>
        )
      };
    });
    return [...otherSubstateOptions, ...currentSubstateOptions];
  }, [isLoading, state, substatesData.rows]);

  const openEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onStateChange = useCallback((value) => {
    if (!value) return;
    const [state, substate] = value.split('__');
    onChange(state, substate);
  }, [onChange]);

  const onHotKey = useCallback((event) => {
    if (isInputOrEditorActive() || isActiveOtherPopover('state-editor-popover')) return;

    if (isS(event)) {
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

  const stateOption = TICKET_STATE_OPTIONS.find(o => o.id === state);

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
          value={`${state}__${substate}`}
          options={options}
          onChange={onStateChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default StateSettings;
