import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { CellType, COLUMNS_ICON_CONFIG } from 'dtable-utils';
import { gettext, siteRoot } from '../../../utils/constants';
import { getFormattedCellValue } from '../utils/cell-value-format';

const OPERATION_TYPE = {
  INSERT_ROW: 'insert_row',
  DELETE_ROW: 'delete_row',
  MODIFY_ROW: 'modify_row',
};

const propTypes = {
  item: PropTypes.object.isRequired,
  userListMap: PropTypes.object,
  dtableUuid: PropTypes.string,
  workspaceId: PropTypes.number,
  departmentListMap: PropTypes.object,
};

const ActivityDetailItem = ({ item, userListMap, dtableUuid, workspaceId, departmentListMap }) => {
  const { avatar_url, op_type, op_time, table_name, row_data, row_count, row_name } = item;

  const renderInsertRowContent = () => {
    const existed_row_count = row_count - 1;
    if (row_name === '' || row_name === null || row_name === undefined) {
      if (row_count > 1) {
        return <span>{gettext('Insert {row_count} rows').replace('{row_count}', row_count)}</span>;
      } else {
        return <span>{gettext('Insert row')}</span>;
      }
    } else {
      if (row_count > 1) {
        return <span>{gettext('Insert row {row_name} and {existed_row_count} other rows').replace('{row_name}', row_name).replace('{existed_row_count}', existed_row_count)}</span>;
      } else {
        return <span>{gettext('Insert row')} {row_name}</span>;
      }
    }
  };

  const renderDeleteRowContent = () => {
    const existed_row_count = row_count - 1;
    if (row_name === '' || row_name === null || row_name === undefined) {
      if (row_count > 1) {
        return <span>{gettext('Delete {row_count} rows').replace('{row_count}', row_count)}</span>;
      } else {
        return <span>{gettext('Delete row')}</span>;
      }
    } else {
      if (row_count > 1) {
        return <span>{gettext('Delete row {row_name} and {existed_row_count} other rows').replace('{row_name}', row_name).replace('{existed_row_count}', existed_row_count)}</span>;
      } else {
        return <span>{gettext('Delete row')} {row_name}</span>;
      }
    }
  };

  const renderModifyRowOperationContent = () => {
    const { newValues, oldValues, columns } = getFormattedCellValue(row_data, true, { userListMap, departmentListMap, dtableUuid, workspaceId });
    let rowOperationContent = [];
    for (let i = 0; i < columns.length; i++) {
      const oldValue = oldValues[i];
      const newValue = newValues[i];
      const column = columns[i];
      const { type, key, name } = column;
      if (type === CellType.LAST_MODIFIER) {
        continue;
      }
      if (oldValue === null && newValue === null) {
        continue;
      }
      rowOperationContent.push(
        <div key={`activity-column-${key}`} className={`modify-row-content w-100 ${i > 0 ? 'mt-2' : ''}`}>
          <div className={'activity-detail-column-title'}>
            <i className={`activity-detail-column-icon ${COLUMNS_ICON_CONFIG[type]}`}></i>
            <span className="activity-detail-column-name">{name}</span>
          </div>
          <div className="activity-detail">
            {oldValue && (<span className="detail-left mr-2">{oldValue}</span>)}
            {newValue && (<span className="detail-right">{newValue}</span>)}
          </div>
        </div>
      );
    }
    if (rowOperationContent.length === 0) {
      rowOperationContent[0] = <div key="activity-column-none" className="activity-detail">{gettext('Modify row')}</div>;
    }
    return rowOperationContent;
  };

  const renderOperationContent = (op_type) => {
    switch (op_type) {
      case OPERATION_TYPE.INSERT_ROW:
        return renderInsertRowContent();
      case OPERATION_TYPE.DELETE_ROW:
        return renderDeleteRowContent();
      case OPERATION_TYPE.MODIFY_ROW:
        return renderModifyRowOperationContent();
      default:
        return <span></span>;
    }
  };

  const userProfileURL = `${siteRoot}profile/${encodeURIComponent(item.author_email)}/`;
  let authorName = item.author_name;
  if (!authorName && item.op_app === 'scripts') {
    authorName = gettext('Script');
  }

  return (
    <div className="activity-detail-item-container">
      <div className="activity-detail-item-header d-flex justify-content-between">
        <div className="d-flex align-items-center">
          <img className="avatar" src={avatar_url} alt="" />
          <div className="title">
            <a href={userProfileURL}>{authorName}</a>
            <span className="operation-name">{gettext('modified')}</span>
            <span className="operation-table text-truncate">{table_name}</span>
            <div className="time-content">
              {dayjs(op_time).format('YYYY-MM-DD HH:mm')}
            </div>
          </div>
        </div>
      </div>
      <div className="activity-detail-item-content">
        {row_name && <div className="modify-row-name">{row_name}</div>}
        {renderOperationContent(op_type)}
      </div>
    </div>
  );
};

ActivityDetailItem.propTypes = propTypes;

export default ActivityDetailItem;
