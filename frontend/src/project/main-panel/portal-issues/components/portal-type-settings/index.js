import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor, CustomizeLabel } from '@/components';
import { getRowById } from '@/sea-metadata/utils/row';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { isEsc, isShiftT } from '@/utils/hotkey';

import './index.css';

const PortalTypeSettings = ({
  id,
  isReadonly,
  value,
  typesData,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const editorRef = useRef(null);

  const isLoading = !typesData || !typesData.rows;

  const options = useMemo(() => {
    if (isLoading) return [];
    return typesData.rows.map(o => ({
      ...o,
      value: o._id,
    }));
  }, [isLoading, typesData]);

  const openEditor = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onTypeChange = useCallback((type) => {
    onChange(type);
    closeEditor();
  }, [onChange, closeEditor]);

  const onHotKey = useCallback((event) => {
    if (isInputOrEditorActive() || isActiveOtherPopover('portal-type-editor-popover')) return;

    if (isShiftT(event)) {
      openEditor(event);
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

  const typeOption = !isLoading && getRowById(typesData, value);

  return (
    <>
      <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
        <CustomizeLabel icon="single-select">
          {gettext('Type')}
        </CustomizeLabel>
        <div className={classnames('ticket-types-formatter', { 'valid': typeOption })} onClick={openEditor} ref={editorRef}>
          {typeOption ? <Option option={typeOption} /> : <div className="tip-default">{gettext('No types')}</div>}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <OptionEditor
          id={id || 'portal-type-editor-popover'}
          className="popover-radius-4 sea-ticket-settings-popover"
          target={editorRef}
          sameWidthWithTarget={240}
          isMultiple={false}
          value={value}
          placeholder={gettext('Search type')}
          emptyTip={gettext('No types')}
          options={options}
          onChange={onTypeChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default PortalTypeSettings;
