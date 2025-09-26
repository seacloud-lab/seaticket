import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import GroupbyItem from './groupby-item';
import { gettext } from '@/constants';

const Groupbys = ({ readOnly, groupbys, columns, onDelete, onUpdate, onMove }) => {
  const isEmpty = useMemo(() => {
    if (!Array.isArray(groupbys) || groupbys.length === 0) return true;
    return false;
  }, [groupbys]);
  const showDragBtn = useMemo(() => {
    if (readOnly) return false;
    if (!Array.isArray(groupbys) || groupbys.length === 0) return false;
    return groupbys.length > 1;
  }, [readOnly, groupbys]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={classnames('groupbys-list', { 'empty-groupbys-container': isEmpty })}>
        {isEmpty && <div className="empty-groupbys-list tip-default">{gettext('No groupings applied to this view.')}</div>}
        {!isEmpty && groupbys.map((groupby, index) => {
          return (
            <GroupbyItem
              key={index}
              index={index}
              readOnly={readOnly}
              showDragBtn={showDragBtn}
              groupby={groupby}
              columns={columns}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onMove={onMove}
            />
          );
        })}
      </div>
    </DndProvider>
  );
};

Groupbys.propTypes = {
  groupbys: PropTypes.array,
  columns: PropTypes.array,
  onDelete: PropTypes.func,
  onUpdate: PropTypes.func,
  onMove: PropTypes.func,
};

export default Groupbys;
