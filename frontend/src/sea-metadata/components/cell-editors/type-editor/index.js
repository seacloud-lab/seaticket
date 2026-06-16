import React, { forwardRef, useMemo, useImperativeHandle, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getTypesOptions } from '../../../utils/column';
import OptionEditorContainer from '@/components/option-editor/option-editor-container';
import { useTypesData } from '../../../hooks';
import { gettext } from '@/constants';
import Tag from '@/sea-metadata/components/tag';
import RemoveBtn from '@/sea-metadata/components/tag/remove-btn';

import './index.css';

const TypeEditor = forwardRef(({
  height: rowHeight,
  column,
  value,
  editorPosition = { left: 0, top: 0 },
  onCommit,
  onPressTab,
}, ref) => {
  const editorRef = useRef(null);
  const optionEditorContainerRef = useRef(null);

  const { typesData } = useTypesData();

  const options = useMemo(() => getTypesOptions(typesData), [typesData]);

  const selectedType = useMemo(() => {
    if (!value) return null;
    const type = options.find(option => option.value === value);
    if (!type) return null;
    return type;
  }, [options, value]);

  const style = useMemo(() => {
    return { width: column.width, top: rowHeight - 1 };
  }, [column, rowHeight]);

  const onSubmit = useCallback((value) => {
    setTimeout(() => onCommit && onCommit(true), 1);
  }, [onCommit]);

  useEffect(() => {
    if (editorRef.current) {
      const { bottom } = editorRef.current.getBoundingClientRect();
      if (bottom > window.innerHeight) {
        editorRef.current.style.top = 'unset';
        editorRef.current.style.bottom = editorPosition.top + rowHeight - window.innerHeight + 'px';
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => {
      const { key } = column;
      const value = optionEditorContainerRef.current.getValue();
      return { [key]: value };
    },
    onBlur: () => {
      const value = optionEditorContainerRef.current.getValue();
      onCommit && onCommit(value);
    },
  }), [column, onCommit]);

  return (
    <div className="sea-metadata-single-select-editor option-editor-popover" style={style} ref={editorRef}>
      <OptionEditorContainer
        ref={optionEditorContainerRef}
        isMultiple={false}
        isSearchEnabled={true}
        value={value}
        emptyTip={gettext('No options available')}
        placeholder={gettext('Search options')}
        addToolText={gettext('Add option')}
        options={options}
        onChange={onSubmit}
        onPressTab={onPressTab}
      >
        {({ value: selectedTypeId, onChange }) => {
          if (!selectedTypeId) return null;
          if (!selectedType || selectedType.value !== selectedTypeId) return null;
          return (
            <Tag tag={selectedType} className="m-0">
              <RemoveBtn callback={() => onChange(selectedTypeId)} />
            </Tag>
          );
        }}
      </OptionEditorContainer>
    </div>
  );
});

TypeEditor.propTypes = {
  height: PropTypes.number,
  column: PropTypes.object,
  columns: PropTypes.array,
  row: PropTypes.object,
  value: PropTypes.string,
  editorPosition: PropTypes.object,
  onCommit: PropTypes.func,
  onPressTab: PropTypes.func,
};

export default TypeEditor;
