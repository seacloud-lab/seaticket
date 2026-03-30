import React, { forwardRef, useMemo, useImperativeHandle, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getColumnOptions, generateNewOption, getOption } from '../../../utils/column';
import context from '@/sea-metadata/context';
import OptionEditorContainer from '@/components/option-editor/option-editor-container';
import { gettext } from '@/constants';
import { IconButton, Option } from '@/components';

import '../single-select-editor/index.css';

const MultipleSelectEditor = forwardRef(({
  height,
  column,
  columns,
  row,
  value,
  editorPosition = { left: 0, top: 0 },
  onCommit,
  onPressTab,
  modifyColumnData,
}, ref) => {
  const editorRef = useRef(null);
  const optionEditorContainerRef = useRef(null);
  const canEditData = context.canModifyColumnData(column);

  const options = useMemo(() => {
    const options = getColumnOptions(column);
    return options.map(o => ({ ...o, name: o.display_name || o.name, value: o.id }));
  }, [column]);

  const style = useMemo(() => {
    return { width: Math.max(column.width, 300), top: height - 2 };
  }, [column, height]);

  const createOption = useCallback((name) => {
    const newOption = generateNewOption(options, name || '');
    let newOptions = options.slice(0);
    newOptions.push(newOption);
    modifyColumnData(column.key, { options: newOptions }, { options: column.data.options || [] });
    return new Promise((resolve, reject) => {
      resolve({ value: newOption.id });
    });
  }, [column, options, onCommit, modifyColumnData]);

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
    <div className="sea-metadata-single-select-editor option-editor-popover sea-metadata-multiple-select-editor" style={style} ref={editorRef}>
      <OptionEditorContainer
        ref={optionEditorContainerRef}
        isMultiple={true}
        placeholder={gettext('Search options')}
        emptyTip={gettext('No options available')}
        addToolText={gettext('Add option')}
        value={value || []}
        options={options}
        onCreate={canEditData ? createOption : null}
        onPressTab={onPressTab}
      >
        {({ value, onChange }) => {
          if (value.length === 0) return null;
          return value.map(item => {
            const option = getOption(options, item);
            return (
              <Option option={option} className="sea-metadata-multiple-select-editor-option">
                <IconButton
                  icon="close"
                  onClick={() => onChange(item)}
                  className="sea-metadata-select-remove-btn no-hover-bg"
                  size={{ btn: 14, icon: 10 }}
                  style={{ margin: '0 -2px 0 2px', cursor: 'pointer' }}
                  iconStyle={{ color: option.text_color }}
                />
              </Option>
            );
          });
        }}
      </OptionEditorContainer>
    </div>
  );
});

MultipleSelectEditor.propTypes = {
  height: PropTypes.number,
  column: PropTypes.object,
  columns: PropTypes.array,
  row: PropTypes.object,
  value: PropTypes.string,
  editorPosition: PropTypes.object,
  onCommit: PropTypes.func,
  onPressTab: PropTypes.func,
};

export default MultipleSelectEditor;
