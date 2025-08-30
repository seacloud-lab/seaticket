import React, { useMemo, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import IconBtn from '@/components/icon-button';
import { GroupbysPopover } from '../popover';
import { gettext } from '@/constants';
import { SUPPORT_GROUP_COLUMN_TYPES } from '../../constants';
import { isEnter, isSpace } from '@/utils/hotkey';
import { getValidGroupbys } from '../../utils/group';
import context from '@/sea-metadata/context';

const GroupbySetter = ({
  target = 'sea-metadata-groupby-popover',
  columns: allColumns,
  readOnly,
  groupbys: propsGroupbys,
  wrapperClass,
  modifyGroupbys
}) => {
  const [isShowSetter, setShowSetter] = useState(false);

  const columns = useMemo(() => {
    return allColumns.filter(column => SUPPORT_GROUP_COLUMN_TYPES.includes(column.type));
  }, [allColumns]);

  const groupbys = useMemo(() => {
    return getValidGroupbys(propsGroupbys, columns) || [];
  }, [columns, propsGroupbys]);

  const message = useMemo(() => {
    const groupbysLength = groupbys ? groupbys.length : 0;
    if (groupbysLength === 1) return context.translate('Grouped by 1 {column}');
    if (groupbysLength > 1) return context.translate('Grouped by {count} {columns}', { count: groupbysLength });
    return gettext('Group');
  }, [groupbys]);

  const onSetterToggle = useCallback(() => {
    setShowSetter(!isShowSetter);
  }, [isShowSetter]);

  const onKeyDown = useCallback((event) => {
    event.stopPropagation();
    if (isEnter(event) || isSpace(event)) onSetterToggle();
  }, [onSetterToggle]);

  const onChange = useCallback((groupbys) => {
    const validGroupbys = getValidGroupbys(groupbys, columns);
    modifyGroupbys(validGroupbys);
  }, [columns, modifyGroupbys]);

  const className = classnames(wrapperClass, { 'active': groupbys.length > 0 });
  return (
    <>
      <IconBtn
        icon="group"
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
        <GroupbysPopover
          readOnly={readOnly}
          groupbys={groupbys}
          target={target}
          placement="bottom-end"
          columns={columns}
          hidePopover={onSetterToggle}
          onChange={onChange}
        />
      )}
    </>
  );

};

GroupbySetter.propTypes = {
  readOnly: PropTypes.bool,
  wrapperClass: PropTypes.string,
  columns: PropTypes.array,
  groupbys: PropTypes.array, // valid groupbys
  modifyGroupbys: PropTypes.func,
  target: PropTypes.string,
};

export default GroupbySetter;
