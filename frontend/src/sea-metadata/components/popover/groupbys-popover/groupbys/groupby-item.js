import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { CustomizeSelect, Icon } from '@/components';
import { gettext } from '@/constants';
import { ColumnSelector, SortSelector } from '@/sea-metadata/components/selectors';
import { SORT_TYPE, SORT_COLUMN_OPTIONS } from '../../../../constants';
import { getColumnByKey } from '../../../../utils/column';
import { getGroupbyGranularityByColumn, isShowGroupCountType, getSelectedCountType, getDefaultCountType } from '../../../../utils/group';

/*
  groupby: {
    column_key: 'xxx',
    count_type: 'xxx, // date/geolocation used
    sort_type: 'xxx',
  }
*/
const GroupbyItem = ({ showDragBtn, index, readOnly, groupby, columns, onDelete, onUpdate, onMove }) => {
  const ref = useRef(null);

  const [dropPosition, setDropPosition] = useState(null);

  const [, drag, preview] = useDrag({
    type: 'sfMetadataGroupbyItem',
    item: () => ({
      idx: index,
      data: groupby,
    }),
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'sfMetadataGroupbyItem',
    hover: (item, monitor) => {
      if (!ref.current) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      const newPosition = hoverClientY < hoverMiddleY ? 'top' : 'bottom';
      setDropPosition(newPosition);
    },
    drop: (item) => {
      if (item.idx === index) return;
      if (item.idx === index - 1 && dropPosition === 'top') return;
      if (item.idx === index + 1 && dropPosition === 'bottom') return;
      onMove(item, { idx: index, data: groupby });
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    })
  });

  drop(preview(ref));

  const column = useMemo(() => getColumnByKey(columns, groupby?.column_key), [groupby, columns]);

  const DISPLAY_GROUP_DATE_GRANULARITY_TEXT = useMemo(() => {
    return {
      'By day': gettext('By day'),
      'By week': gettext('By week'),
      'By month': gettext('By month'),
      'By quarter': gettext('By quarter'),
      'By year': gettext('By year'),
    };
  }, []);

  const countTypeOptions = useMemo(() => {
    const { granularityList, displayGranularity } = getGroupbyGranularityByColumn(column);
    return granularityList.map((granularity) => {
      return {
        value: granularity,
        label: DISPLAY_GROUP_DATE_GRANULARITY_TEXT[displayGranularity[granularity]],
      };
    });
  }, [column, DISPLAY_GROUP_DATE_GRANULARITY_TEXT]);

  const selectedCountType = useMemo(() => getSelectedCountType(column, groupby?.count_type), [column, groupby]);

  const deleteGroupby = useCallback((event) => {
    event.nativeEvent.stopImmediatePropagation();
    onDelete(index);
  }, [index, onDelete]);

  const handleSelectColumn = useCallback((newColumnKey) => {
    const { column_key } = groupby;
    if (newColumnKey === column_key) return;
    const newColumn = getColumnByKey(columns, newColumnKey);
    const sort_type = SORT_TYPE.UP;
    const count_type = getDefaultCountType(newColumn);
    const newGroupby = {
      ...groupby,
      ...{ column_key: newColumnKey, sort_type, count_type }
    };
    onUpdate(newGroupby, index);
  }, [groupby, index, columns, onUpdate]);

  const handleSelectCountType = useCallback((countType) => {
    if (countType === groupby.count_type) return;
    const newGroupby = { ...groupby, count_type: countType };
    onUpdate(newGroupby, index);
  }, [groupby, index, onUpdate]);

  const handleSelectSortType = useCallback((newSortType) => {
    if (newSortType === groupby.sort_type) return;
    const newGroupby = { ...groupby, sort_type: newSortType };
    onUpdate(newGroupby, index);
  }, [groupby, index, onUpdate]);

  return (
    <div
      ref={ref}
      className={classnames('groupby-item',
        { 'group-can-drop-top': isOver && canDrop && dropPosition === 'top' },
        { 'group-can-drop-bottom': isOver && canDrop && dropPosition === 'bottom' }
      )}
    >
      {!readOnly && (
        <div className="delete-groupby" onClick={deleteGroupby} aria-label={gettext('Delete')}>
          <Icon className="sea-metadata-icon" symbol="close" />
        </div>
      )}
      <div className="condition">
        <div className="groupby-column">
          <ColumnSelector
            disabled={readOnly}
            value={column.key}
            columns={columns}
            onChange={handleSelectColumn}
          />
        </div>
        {isShowGroupCountType(column) && (
          <div className="groupby-count-type">
            <CustomizeSelect
              disabled={readOnly}
              value={selectedCountType}
              options={countTypeOptions}
              onChange={handleSelectCountType}
            />
          </div>
        )}
        <div className="groupby-predicate">
          {(!column.key || SORT_COLUMN_OPTIONS.includes(column.type)) && (
            <SortSelector
              disabled={readOnly}
              value={groupby.sort_type}
              onChange={handleSelectSortType}
            />
          )}
        </div>
      </div>
      {!readOnly && showDragBtn && (
        <div ref={drag} className="groupby-drag">
          <Icon symbol="drag" />
        </div>
      )}
    </div>
  );

};

GroupbyItem.propTypes = {
  index: PropTypes.number,
  readOnly: PropTypes.bool,
  groupby: PropTypes.object,
  columns: PropTypes.array,
  onDelete: PropTypes.func,
  onUpdate: PropTypes.func,
  onMove: PropTypes.func,
};

export default GroupbyItem;
