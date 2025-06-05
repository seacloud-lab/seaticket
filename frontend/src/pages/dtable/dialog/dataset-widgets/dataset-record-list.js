import React from 'react';
import PropTypes from 'prop-types';
import { COLUMNS_ICON_CONFIG } from 'dtable-utils';
import { DATASET_NOT_SUPPORT_COLUMN_TYPES } from './dataset-utils';
import DatasetRecordItem from './dataset-record-item';

const propTypes = {
  rows: PropTypes.array,
  columns: PropTypes.array,
  relatedUserList: PropTypes.array,
};

class DatasetRecordList extends React.Component {

  renderTableThread = () => {
    const { columns } = this.props;
    const displayColumns = columns.filter(column => !DATASET_NOT_SUPPORT_COLUMN_TYPES.includes(column.type));

    return (
      <tr>
        {displayColumns.map((column) => {
          const { key, width, type, name } = column;
          return (
            <th key={key} style={{ width: width }}>
              <span className="header-icon">
                <i className={COLUMNS_ICON_CONFIG[type]}></i>
              </span>
              <span className="header-name">{name}</span>
            </th>
          );
        })}
      </tr>
    );
  };

  render() {
    const { rows, columns, relatedUserList } = this.props;
    return (
      <table>
        <thead>
          {this.renderTableThread()}
        </thead>
        <tbody>
          {rows && rows.map(row => {
            return (
              <DatasetRecordItem
                key={row._id}
                row={row}
                columns={columns}
                relatedUserList={relatedUserList}
              />
            );
          })}
        </tbody>
      </table>
    );
  }
}

DatasetRecordList.propTypes = propTypes;

export default DatasetRecordList;
