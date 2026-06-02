import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor, CustomizeLabel } from '@/components';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { isEsc, isShiftT } from '@/utils/hotkey';
import { getColumnOptions, getOption } from '@/sea-metadata/utils/column';

import './index.css';

const SingleSelectSettings = ({
  id,
  isReadonly,
  value,
  className = 'mb-4',
  column,
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const editorRef = useRef(null);

  const options = useMemo(() => {
    const _options = getColumnOptions(column);
    return _options ? _options.map(o => ({
      ...o,
      value: o.id,
    })) : [];
  }, [column]);

  const option = useMemo(() => getOption(options, value), [options, value]);

  const openEditor = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const handleChange = useCallback((newOptionId) => {
    if (option && option.id === newOptionId) {
      onChange(null);
      return;
    }
    const newOption = getOption(options, newOptionId);
    onChange(newOption.name);
  }, [option, options, onChange]);

  const onHotKey = useCallback((event) => {
    if (!id) return;
    if (isInputOrEditorActive() || isActiveOtherPopover(id)) return;

    if (isShiftT(event)) {
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

  return (
    <>
      <div className={classnames('seaqa-settings-item', className)}>
        <CustomizeLabel icon="single-select">
          {column?.display_name || column?.name}
        </CustomizeLabel>
        <div className={classnames('seaqa-single-select-settings-formatter', { 'valid': option, 'cursor-pointer': !isReadonly })} onClick={openEditor} ref={editorRef}>
          {option ? <Option option={option} /> : <div className="seaqa-tip-default">{gettext('No option')}</div>}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <OptionEditor
          id={id}
          className="seaqa-settings-popover"
          target={editorRef}
          sameWidthWithTarget={240}
          isMultiple={false}
          value={value}
          placeholder={gettext('Search option')}
          emptyTip={gettext('No options')}
          options={options}
          onChange={handleChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default SingleSelectSettings;
