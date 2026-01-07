import React, { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import IconBtn from '@/components/icon-button';
import { HideColumnPopover } from '../popover';
import { isEnter, isSpace } from '@/utils/hotkey';
import { TABLE_NOT_DISPLAY_COLUMN_KEYS } from '../../constants';
import context from '@/sea-metadata/context';

const HideColumnSetter = ({ readOnly, columns, wrapperClass, target, hiddenColumns, modifyHiddenColumns, modifyColumnOrder }) => {
  const [isShowSetter, setShowSetter] = useState(false);

  const validColumns = useMemo(() => columns.filter(column => !TABLE_NOT_DISPLAY_COLUMN_KEYS.includes(column.key)), [columns]);

  const validHiddenColumns = useMemo(() => {
    return hiddenColumns.filter(key => columns.find(column => column.key === key));
  }, [columns, hiddenColumns]);

  const message = useMemo(() => {
    const hiddenColumnsLength = validHiddenColumns.length;
    if (hiddenColumnsLength === 1) return context.translate('1 hidden {column}');
    if (hiddenColumnsLength > 1) return context.translate('{count} hidden {columns}', { count: hiddenColumnsLength });
    return context.translate('Hide {columns}');
  }, [validHiddenColumns]);

  const onSetterToggle = useCallback(() => {
    setShowSetter(!isShowSetter);
  }, [isShowSetter]);

  const onKeyDown = useCallback((event) => {
    event.stopPropagation();
    if (isEnter(event) || isSpace(event)) onSetterToggle();
  }, [onSetterToggle]);

  const onChange = useCallback((hiddenColumns) => {
    modifyHiddenColumns(hiddenColumns);
  }, [modifyHiddenColumns]);

  const className = classnames(wrapperClass, { 'active': validHiddenColumns.length > 0 });
  return (
    <>
      <IconBtn
        icon="eye-slash"
        size={24}
        className={className}
        onClick={onSetterToggle}
        role="button"
        onKeyDown={onKeyDown}
        title={message}
        aria-label={message}
        tabIndex={0}
        id={target}
      />
      {isShowSetter && (
        <HideColumnPopover
          readOnly={readOnly}
          hiddenColumns={validHiddenColumns}
          target={target}
          placement="bottom-end"
          columns={validColumns}
          hidePopover={onSetterToggle}
          onChange={onChange}
          modifyColumnOrder={modifyColumnOrder}
        />
      )}
    </>
  );
};

HideColumnSetter.propTypes = {
  readOnly: PropTypes.bool,
  wrapperClass: PropTypes.string,
  target: PropTypes.string,
  hiddenColumns: PropTypes.array,
  columns: PropTypes.array,
  modifyHiddenColumns: PropTypes.func,
  modifyColumnOrder: PropTypes.func,
};

export default HideColumnSetter;
