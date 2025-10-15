import React, { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import IconBtn from '@/components/icon-button';
import { RowHeightPopover } from '../popover';
import { isEnter, isSpace } from '@/utils/hotkey';
import { ROW_HEIGHT_TYPE } from '../../constants';

const RowHeightSetter = ({ readOnly, wrapperClass, rowHeight, target, modifyRowHeight }) => {
  const [isShowSetter, setShowSetter] = useState(false);

  const message = useMemo(() => {
    return rowHeight;
  }, [rowHeight]);

  const onSetterToggle = useCallback(() => {
    setShowSetter(!isShowSetter);
  }, [isShowSetter]);

  const onKeyDown = useCallback((event) => {
    event.stopPropagation();
    if (isEnter(event) || isSpace(event)) onSetterToggle();
  }, [onSetterToggle]);

  const onChange = useCallback((rowHeight) => {
    modifyRowHeight(rowHeight);
  }, [modifyRowHeight]);

  const className = classnames(wrapperClass, { 'active': rowHeight !== ROW_HEIGHT_TYPE.DEFAULT });
  return (
    <>
      <IconBtn
        icon="row-height-default"
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
        <RowHeightPopover
          readOnly={readOnly}
          target={target}
          rowHeight={rowHeight}
          hidePopover={onSetterToggle}
          onChange={onChange}
        />
      )}
    </>
  );
};

RowHeightSetter.propTypes = {
  readOnly: PropTypes.bool,
  wrapperClass: PropTypes.string,
  target: PropTypes.string,
  rowHeight: PropTypes.string,
  modifyRowHeight: PropTypes.func,
};

export default RowHeightSetter;
