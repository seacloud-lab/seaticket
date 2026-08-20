import React, { forwardRef, useMemo, useImperativeHandle, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getTypesOptions } from '../../../utils/column';
import Container from '@/components/options-editor/sync-options-editor/container';
import { useTypesData } from '../../../hooks';
import { gettext } from '@/constants';

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

  const style = useMemo(() => {
    return { width: 300, top: 0 };
  }, []);

  const onSubmit = useCallback((value) => {
    setTimeout(() => onCommit && onCommit(true), 1);
  }, [onCommit]);

  useEffect(() => {
    if (editorRef.current) {
      const { bottom, right } = editorRef.current.getBoundingClientRect();
      if (bottom > window.innerHeight) {
        editorRef.current.style.top = 'unset';
        editorRef.current.style.bottom = editorPosition.top + rowHeight - window.innerHeight + 'px';
      }
      if (right > window.innerWidth) {
        const parentNode = editorRef.current.parentElement;
        if (parentNode) {
          const overflow = right - window.innerWidth + 10;
          parentNode.style.left = `${parentNode.offsetLeft - overflow}px`;
        }
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
    <div className="sea-metadata-single-select-editor options-editor-popover" style={style} ref={editorRef}>
      <Container
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
      </Container>
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
