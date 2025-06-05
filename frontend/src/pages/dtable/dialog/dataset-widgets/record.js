import React from 'react';
import PropTypes from 'prop-types';
import { CellType } from 'dtable-utils';
import Formatter from './formatter';

function Record(props) {
  const { columns, record, index, collaborators, isLastRecord } = props;
  return (
    <div className={`dtable-dataset-result-table-row ${isLastRecord ? 'dtable-dataset-last-table-row' : ''}`}>
      {columns.map(column => {
        const { key, name, width, type, data } = column;
        const value = record[name] || record[key];
        let className = 'dtable-dataset-result-table-cell ';
        if (type === CellType.FORMULA || type === CellType.LINK_FORMULA) {
          className += 'dtable-dataset-result-table-formula-cell ';
          const { array_type } = data || {};
          if (array_type === CellType.IMAGE || array_type === CellType.FILE) {
            className += 'dtable-dataset-result-table-formula-image-cell';
          }
        } else {
          className += `dtable-dataset-result-table-${type}-cell`;
        }
        return (
          <div
            key={`${key}-${{ index }}`}
            className={className}
            style={{ width, maxWidth: width, minWidth: width }}
          >
            <Formatter
              collaborators={collaborators}
              cellValue={value}
              column={column}
              row={record}
              getOptionColors={props.getOptionColors}
              getUserCommonInfo={props.getUserCommonInfo}
              queryUsers={props.queryUsers}
            />
          </div>
        );
      })}
    </div>
  );
}

Record.propTypes = {
  isLastRecord: PropTypes.bool,
  columns: PropTypes.array.isRequired,
  record: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  collaborators: PropTypes.array,
  openEnlargeFormatter: PropTypes.func,
  getUserCommonInfo: PropTypes.func,
  getOptionColors: PropTypes.func,
  onOpenRecordExpandDialog: PropTypes.func,
  queryUsers: PropTypes.func,
};

export default Record;
