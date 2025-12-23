import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Icon } from '@/components';
import CustomizePopover from '@/components/customize-popover';
import PriorityItem from '@/sea-metadata/components/cell-editors/priority-editor/priority-item';
import { isInputOrEditorActive } from '@/utils/dom';
import { PRIORITIES } from '@/sea-metadata/constants';
import { isEsc, isEnter, isP, isUpArrow, isDownArrow } from '@/utils/hotkey';

import './index.css';

const RateSettings = ({
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
    if (isInputOrEditorActive()) return;

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
    }
  }, [openEditor, closeEditor, onUpArrow, onDownArrow, highlightIndex, isShowEditor]);

  useEffect(() => {
    document.addEventListener('keydown', onHotKey, true);
    return () => {
      document.removeEventListener('keydown', onHotKey, true);
    };
  }, [onHotKey]);

  const rateOption = PRIORITIES.find(o => o.value === value);

  return (
    <>
      <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
        <Label>{gettext('Priority')}</Label>
        <div className="ticket-rate-formatter" id="ticket-rate-formatter" onClick={openEditor} ref={editorRef}>
          <div className={classnames('d-flex align-items-center', { 'tip-default': !rateOption.value })}>
            {rateOption.value ? (<Icon className="mr-1" symbol={rateOption.icon} title={rateOption.name}/>) : '' }
            {gettext(rateOption.name)}
          </div>
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <CustomizePopover
          target={'ticket-rate-formatter'}
          className={classnames('sea-metadata-priority-editor-popover-container')}
          hidePopover={closeEditor}
          hidePopoverWithEsc={closeEditor}
          modifiers={[
            { name: 'preventOverflow', options: { boundary: document.body } },
            { name: 'offset', options: { offset: [-6, 8] } }
          ]}
        >
          <div className="sea-metadata-priority-editor-popover">
            {PRIORITIES.map((item, index) => (
              <PriorityItem
                key={index}
                value={item.value}
                hotKey={item.hotKey}
                onClick={onChangeValue}
                readOnly={false}
                isSelected={item.value === value}
                isActive={highlightIndex === index}
              />
            ))}
          </div>
        </CustomizePopover>
      )}
    </>
  );
};

export default RateSettings;
