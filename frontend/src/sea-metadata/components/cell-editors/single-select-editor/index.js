import React, { forwardRef, useMemo, useImperativeHandle, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getCellValueByColumn } from '../../../utils/cell';
import { getColumnByKey, getColumnOptions, generateNewOption } from '../../../utils/column';
import context from '@/sea-metadata/context';
import OptionEditorContainer from '@/components/option-editor/option-editor-container';
import { gettext } from '@/constants';
import { PREDEFINED_TICKET_COLUMN_NAME } from '@/project/main-panel/tickets/constants';

import './index.css';

const SingleSelectEditor = forwardRef(({
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
    const { data } = column;
    const { cascade_column_key, cascade_settings } = data || {};
    if (cascade_column_key) {
      const cascadeColumn = getColumnByKey(columns, cascade_column_key);
      if (cascadeColumn) {
        const cascadeColumnValue = getCellValueByColumn(row, cascadeColumn);
        if (!cascadeColumnValue) return [];
        const cascadeSetting = cascade_settings[cascadeColumnValue];
        if (!cascadeSetting || !Array.isArray(cascadeSetting) || cascadeSetting.length === 0) return [];
        return options
          .filter(option => cascadeSetting.includes(option.id))
          .map(o => ({
            ...o,
            name: o.display_name || o.name,
            value: o.id
          }));
      }
    }
    return options.map(o => ({ ...o, name: o.display_name || o.name, value: o.id }));
  }, [row, column, columns]);

  const style = useMemo(() => {
    return { width: column.width, top: height - 2 };
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
        placeholder={gettext('Search options')}
        emptyTip={gettext('No options available')}
        addToolText={gettext('Add option')}
        value={value}
        options={options}
        onChange={onSubmit}
        onCreate={canEditData ? createOption : null}
        onPressTab={onPressTab}
        isSearchEnabled={column.name !== PREDEFINED_TICKET_COLUMN_NAME.STATE}
      />
    </div>
  );
});

SingleSelectEditor.propTypes = {
  height: PropTypes.number,
  column: PropTypes.object,
  columns: PropTypes.array,
  row: PropTypes.object,
  value: PropTypes.string,
  editorPosition: PropTypes.object,
  onCommit: PropTypes.func,
  onPressTab: PropTypes.func,
};

export default SingleSelectEditor;
