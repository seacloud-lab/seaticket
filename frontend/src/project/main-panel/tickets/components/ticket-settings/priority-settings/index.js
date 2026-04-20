import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Icon, PriorityEditor, CustomizeLabel } from '@/components';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { PRIORITIES } from '@/sea-metadata/constants';
import { isEsc, isEnter, isP, isUpArrow, isDownArrow } from '@/utils/hotkey';

import './index.css';

const PrioritySettings = ({
  isReadonly,
  value,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const editorRef = useRef(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const openEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
    setHighlightIndex(-1);
  }, []);

  const onChangeValue = useCallback((value) => {
    onChange(value);
    closeEditor();
  }, [onChange]);

  const onUpArrow = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    highlightIndex > 0 ? setHighlightIndex(highlightIndex - 1) : setHighlightIndex(PRIORITIES.length - 1);
  }, [highlightIndex]);

  const onDownArrow = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    highlightIndex < PRIORITIES.length - 1 ? setHighlightIndex(highlightIndex + 1) : setHighlightIndex(0);
  }, [highlightIndex]);

  const onHotKey = useCallback((event) => {
    if (isInputOrEditorActive() || isActiveOtherPopover('priority-editor-popover')) return;

    if (isP(event)) {
      openEditor();
    } else if (isUpArrow(event) && isShowEditor) {
      onUpArrow(event);
    } else if (isDownArrow(event) && isShowEditor) {
      onDownArrow(event);
    } else if (isEsc(event)) {
      closeEditor();
    } else if (isEnter(event) && isShowEditor) {
      const value = PRIORITIES[highlightIndex].value;
      onChangeValue(value);
    } else if (isShowEditor && Number(event.key) >= 0 && Number(event.key) <= 4) {
      event.preventDefault();
      event.stopPropagation();
      // eslint-disable-next-line
      const selectedPriority = PRIORITIES.find(item => item.hotKey == event.key);
      if (selectedPriority && selectedPriority.value !== value) {
        onChangeValue(selectedPriority.value);
        closeEditor();
      }
    }
  }, [openEditor, closeEditor, onUpArrow, onDownArrow, highlightIndex, isShowEditor]);

  useEffect(() => {
    document.addEventListener('keydown', onHotKey, true);
    return () => {
      document.removeEventListener('keydown', onHotKey, true);
    };
  }, [onHotKey]);

  const option = PRIORITIES.find(o => o.value === value);

  return (
    <>
      <div className={classnames('sea-ticket-settings-item', className)}>
        <CustomizeLabel icon="flag">
          {gettext('Priority')}
        </CustomizeLabel>
        <div className="ticket-rate-formatter" onClick={openEditor} ref={editorRef}>
          <div className={classnames('d-flex align-items-center', { 'tip-default': !option.value })}>
            {option.value ? (<Icon className="mr-1" symbol={option.icon} title={option.name}/>) : '' }
            {option.name}
          </div>
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <PriorityEditor
          target={editorRef}
          priorities={PRIORITIES}
          value={value}
          className="sea-ticket-settings-popover sea-ticket-priority-settings-popover"
          sameWidthWithTarget={240}
          onChange={onChangeValue}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default PrioritySettings;
