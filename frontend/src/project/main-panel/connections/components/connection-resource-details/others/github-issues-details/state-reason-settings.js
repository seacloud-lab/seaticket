import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor, CustomizeLabel } from '@/components';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { getColumnOptions, getOption } from '@/sea-metadata/utils/column';
import { isEsc, isShiftS } from '@/utils/hotkey';
import { GITHUB_STATE_REASON_NAME_MAP } from '../../../../constants';

import '@/project/main-panel/tickets/components/ticket-settings/type-settings/index.css';

const StateReasonSettings = ({
  id,
  isReadonly,
  value,
  column,
  className = 'mb-4',
  state,
  stateColumn,
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const editorRef = useRef(null);

  const options = useMemo(() => {
    const stateOptions = getColumnOptions(stateColumn);
    const stateOption = getOption(stateOptions, state);
    const stateReasonOptions = getColumnOptions(column).map(o => ({ ...o, value: o.id, display_name: GITHUB_STATE_REASON_NAME_MAP[o.name] }));
    if (stateOption.name === 'open') return stateReasonOptions.slice(3);
    return stateReasonOptions.slice(0, 3);
  }, [state, stateColumn, column]);

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
    onChange && onChange({ state_reason: option.name });
  }, [options, onChange]);

  const onHotKey = useCallback((event) => {
    if (isInputOrEditorActive() || isActiveOtherPopover(id)) return;

    if (isShiftS(event)) {
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

  const option = options.find(o => o.name === value);

  return (
    <>
      <div className={classnames('sea-ticket-settings-item mb-4', className)}>
        <CustomizeLabel icon="single-select">
          {gettext('State reason')}
        </CustomizeLabel>
        <div className={classnames('ticket-types-formatter', { 'valid': option, 'cursor-pointer': !isReadonly })} onClick={openEditor} ref={editorRef}>
          {option ? <Option option={option} /> : <div className="seaqa-tip-default">{gettext('No types')}</div>}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <OptionEditor
          id={id}
          className="sea-ticket-settings-popover"
          target={editorRef}
          sameWidthWithTarget={240}
          isMultiple={false}
          value={option?.id}
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

export default StateReasonSettings;
