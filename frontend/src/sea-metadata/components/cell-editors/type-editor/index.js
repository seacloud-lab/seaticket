import React, { forwardRef, useMemo, useImperativeHandle, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getTypesOptions } from '../../../utils/column';
import OptionEditorContainer from '@/components/option-editor/option-editor-container';
import { useTypesData } from '../../../hooks';
import { gettext } from '@/constants';

import './index.css';

const TypeEditor = forwardRef(({
  height,
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

  const style = useMemo(() => {
    return { width: column.width, top: height - 2 };
  }, [column, height]);

  const onSubmit = useCallback((value) => {
    setTimeout(() => onCommit && onCommit(true), 1);
  }, [onCommit]);

  useEffect(() => {
    if (editorRef.current) {
      const { bottom } = editorRef.current.getBoundingClientRect();
      if (bottom > window.innerHeight) {
        editorRef.current.style.top = 'unset';
        editorRef.current.style.bottom = editorPosition.top + height - window.innerHeight + 'px';
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
      />
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
