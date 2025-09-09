import React, { forwardRef, useMemo, useImperativeHandle, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { generateNewOption, getTypesOptions } from '../../../utils/column';
import context from '@/sea-metadata/context';
import Main from '@/components/option-editor/main';
import { gettext } from '@/constants';
import { useTypesData } from '../../../hooks';

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
  const mainRef = useRef(null);

  const { typesData, createType } = useTypesData();

  const canEditData = context.canModifyColumnData(column) && createType;

  const options = useMemo(() => getTypesOptions(typesData), [typesData]);

  const style = useMemo(() => {
    return { width: column.width, top: height - 2 };
  }, [column, height]);

  const createOption = useCallback((name) => {
    const newOption = generateNewOption(options, name || '');
    return createType({ name, color: newOption.color, text_color: newOption.textColor }).then(type => {
      return new Promise((resolve, reject) => {
        resolve({ value: type._id });
      });
    });
  }, [column, options, onCommit, createType]);

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
      const value = mainRef.current.getValue();
      return { [key]: value };
    },
    onBlur: () => {
      const value = mainRef.current.getValue();
      onCommit && onCommit(value);
    },

  }), [column, onCommit]);

  return (
    <div className="sea-metadata-single-select-editor option-editor-popover" style={style} ref={editorRef}>
      <Main
        ref={mainRef}
        isMultiple={false}
        placeholder={gettext('Search options')}
        emptyTip={gettext('No options available')}
        addToolText={gettext('Add option')}
        value={value}
        options={options}
        onChange={onSubmit}
        onCreate={canEditData ? createOption : null}
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
