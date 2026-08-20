import React, { useState, useRef, useCallback } from 'react';
import { PriorityEditor } from '@/components';
import { PRIORITIES } from '@/sea-metadata/constants';
import PriorityFormatter from '@/sea-metadata/components/cell-formatter/priority';
import SelectTrigger from '@/components/customize-select/select-trigger';

const PrioritySelector = ({
  readOnly,
  value,
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const prioritySelectorRef = useRef(null);

  const openEditor = useCallback(() => {
    if (readOnly) return;
    setIsShowEditor(true);
  }, [readOnly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  return (
    <>
      <SelectTrigger
        innerRef={prioritySelectorRef}
        disabled={readOnly}
        focus={isShowEditor}
        selectedValue={(
          <span className="selected-option-show">
            <PriorityFormatter value={Number(value)} showName={true} className={readOnly ? '' : 'cursor-pointer'} />
          </span>
        )}
        onClick={openEditor}
      />
      {!readOnly && isShowEditor && (
        <PriorityEditor
          className="sea-metadata-data-filter-popover"
          target={prioritySelectorRef}
          priorities={PRIORITIES}
          value={value}
          sameWidthWithTarget={300}
          onChange={onChange}
          modifiers={[
            { name: 'preventOverflow', options: { boundary: document.body } },
            { name: 'offset', options: { offset: [0, 4] } }
          ]}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default PrioritySelector;
