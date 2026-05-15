import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor, CustomizeLabel } from '@/components';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { getColumnOptions, getOption } from '@/sea-metadata/utils/column';
import { isEsc, isT } from '@/utils/hotkey';

import '@/project/main-panel/tickets/components/ticket-settings/type-settings/index.css';

const TypeSettings = ({
  id,
  isReadonly,
  value,
  column,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const editorRef = useRef(null);

  const options = useMemo(() => {
    return getColumnOptions(column).map(o => ({ ...o, value: o.id }));
  }, [column]);

  const openEditor = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onTypeChange = useCallback((value) => {
    const option = getOption(options, value);
    if (!option) return;
    onChange && onChange({ issue_type: option.name });
  }, [options, onChange]);

  const onHotKey = useCallback((event) => {
    if (isInputOrEditorActive() || isActiveOtherPopover(id)) return;

    if (isT(event)) {
      openEditor(event);
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

  const typeOption = options.find(o => o.name === value);

  return (
    <>
      <div className={classnames('sea-ticket-settings-item mb-4', className)}>
        <CustomizeLabel icon="single-select">
          {gettext('Type')}
        </CustomizeLabel>
        <div className={classnames('ticket-types-formatter', { 'valid': typeOption, 'cursor-pointer': !isReadonly })} onClick={openEditor} ref={editorRef}>
          {typeOption ? <Option option={typeOption} /> : <div className="tip-default">{gettext('No types')}</div>}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <OptionEditor
          id={id}
          className="sea-ticket-settings-popover"
          target={editorRef}
          sameWidthWithTarget={240}
          isMultiple={false}
          value={typeOption?.id}
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

export default TypeSettings;
