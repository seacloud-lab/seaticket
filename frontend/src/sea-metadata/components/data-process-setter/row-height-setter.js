import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import IconBtn from '@/components/icon-button';
import { RowHeightPopover } from '../popover';
import { gettext } from '@/constants';
import { isEnter, isSpace } from '@/utils/hotkey';

const RowHeightSetter = ({ readOnly, wrapperClass, rowHeight, target, modifyRowHeight }) => {
  const [isShowSetter, setShowSetter] = useState(false);

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

  return (
    <>
      <IconBtn
        icon={`row-height-${rowHeight}`}
        size={24}
        className={wrapperClass}
        onClick={onSetterToggle}
        role="button"
        onKeyDown={onKeyDown}
        tabIndex={0}
        id={target}
        title={gettext('Set row height')}
        aria-label={gettext('Set row height')}
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
