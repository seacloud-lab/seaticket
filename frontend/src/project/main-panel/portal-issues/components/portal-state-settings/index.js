import React, { useCallback, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor, CustomizeLabel } from '@/components';
import { PORTAL_ISSUE_STATUS_OPTIONS } from '../../constants';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { isEsc, isS } from '@/utils/hotkey';

import './index.css';

const PortalStateSettings = ({
  isReadonly,
  state,
  substate,
  substatesData,
  className = 'mb-4',
  onChangeState,
  onChangeSubState,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const editorRef = useRef(null);

  const openEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onHotKey = useCallback((event) => {
    if (isInputOrEditorActive() || isActiveOtherPopover('portal-state-editor-popover')) return;

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

  const stateOption = PORTAL_ISSUE_STATUS_OPTIONS.find(o => o.id === state);

  const options = PORTAL_ISSUE_STATUS_OPTIONS.map(option => ({
    value: option.id,
    label: <Option option={option} />
  }));

  const onStateChange = useCallback((value) => {
    if (!value) return;
    onChangeState(value);
    closeEditor();
  }, [onChangeState, closeEditor]);

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
          id="portal-state-editor-popover"
          className="popover-radius-4 sea-ticket-settings-popover"
          target={editorRef}
          sameWidthWithTarget={200}
          isMultiple={false}
          isSearchEnabled={false}
          value={state}
          options={options}
          onChange={onStateChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default PortalStateSettings;
