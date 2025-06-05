import React from 'react';
import PropTypes from 'prop-types';
import { covertRow, DATASET_NOT_SUPPORT_COLUMN_TYPES } from './dataset-utils';

const propTypes = {
  row: PropTypes.object.isRequired,
  columns: PropTypes.array.isRequired,
  relatedUserList: PropTypes.array.isRequired,
};

class DatasetRecordItem extends React.PureComponent {

  render() {
    const { row, columns, relatedUserList } = this.props;
    const displayColumns = columns.filter(column => !DATASET_NOT_SUPPORT_COLUMN_TYPES.includes(column.type));
    return (
      <tr>
        {displayColumns.map((column, index) => {
          return <td key={index}>{covertRow(row, column, relatedUserList)}</td>;
        })}
      </tr>
    );
  }
}

DatasetRecordItem.propTypes = propTypes;

export default DatasetRecordItem;
