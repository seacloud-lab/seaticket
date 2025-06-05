import React, { Component } from 'react';
import PropTypes from 'prop-types';

class RecordsHeader extends Component {

  render() {
    const { columns } = this.props;
    return (
      <div className="static-dtable-dataset-result-content">
        <div className="dtable-dataset-result-table-row">
          {columns.map(column => {
            const width = column.width;
            return (
              <div key={column.key} className="dtable-dataset-result-table-cell column" style={{ width, maxWidth: width, minWidth: width }}>
                <div className="dtable-dataset-result-column-content text-truncate">
                  {column.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}

RecordsHeader.propTypes = {
  columns: PropTypes.array.isRequired,
};

export default RecordsHeader;
