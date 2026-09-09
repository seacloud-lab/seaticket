import React, { useCallback, useMemo, useState } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import IconBtn from '@/components/icon-button';
import { gettext } from '@/constants';
import { isEnter, isSpace } from '@/utils/hotkey';
import { hasRowColor } from '../../utils/view';
import { RowColorPopover } from '../popover';

const RowColorSetter = ({ target = 'seaqa-row-color-popover', readOnly, columns, colorbys, collaborators, modifyRowColor, wrapperClass }) => {
  const [isShowSetter, setShowSetter] = useState(false);

  const isActive = useMemo(() => hasRowColor(colorbys, columns), [colorbys, columns]);

  const title = useMemo(() => {
    return gettext('Color');
  }, []);

  const onSetterToggle = useCallback(() => {
    setShowSetter(!isShowSetter);
  }, [isShowSetter]);

  const onKeyDown = useCallback((event) => {
    event.stopPropagation();
    if (isEnter(event) || isSpace(event)) onSetterToggle();
  }, [onSetterToggle]);

  const className = classnames(wrapperClass, { active: isActive });
  return (
    <>
      <IconBtn
        icon="shading"
        size={{ btn: 24 }}
        className={className}
        onClick={onSetterToggle}
        role="button"
        onKeyDown={onKeyDown}
        title={title}
        aria-label={title}
        tabIndex={0}
        id={target}
      />
      {isShowSetter && (
        <RowColorPopover
          target={target}
          readOnly={readOnly}
          columns={columns}
          colorbys={colorbys}
          collaborators={collaborators}
          hidePopover={onSetterToggle}
          modifyRowColor={modifyRowColor}
        />
      )}
    </>
  );
};

RowColorSetter.propTypes = {
  target: PropTypes.string,
  readOnly: PropTypes.bool,
  columns: PropTypes.array,
  colorbys: PropTypes.object,
  collaborators: PropTypes.array,
  modifyRowColor: PropTypes.func,
  wrapperClass: PropTypes.string,
};

export default RowColorSetter;
