import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor, CustomizeLabel } from '@/components';
import { useMetadata } from '../../../hooks';
import { getRowById } from '@/sea-metadata/utils/row';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { isEsc, isShiftS } from '@/utils/hotkey';

import '../state-settings/index.css';

const SubStateSettings = ({
  isReadonly,
  state,
  substate,
  className = 'mb-4',
  onChange,
  useMetadataProvider = useMetadata,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const { isLoading, substatesData } = useMetadataProvider();

  const editorRef = useRef(null);

  const options = useMemo(() => {
    if (isLoading) return [];
    const rows = substatesData.rows.filter(r => r.parent_id === state);
    return rows.map(row => {
      return {
        ...row,
        value: row._id,
      };
    });
  }, [state]);

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
    if (isInputOrEditorActive() || isActiveOtherPopover('substate-editor-popover')) return;

    if (isShiftS(event)) {
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

  const substateOption = !isLoading && getRowById(substatesData, substate);

  return (
    <>
      <div className={classnames('sea-ticket-settings-item', className)}>
        <CustomizeLabel icon="single-select">
          {gettext('Substate')}
        </CustomizeLabel>
        <div className={classnames('ticket-state-formatter', { 'valid': substateOption })} onClick={openEditor} ref={editorRef}>
          {substateOption && (<Option option={substateOption} />)}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <OptionEditor
          id="substate-editor-popover"
          className="popover-radius-4 sea-ticket-settings-popover"
          target={editorRef}
          sameWidthWithTarget={240}
          isMultiple={false}
          value={substate}
          options={options}
          onChange={onStateChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default SubStateSettings;
