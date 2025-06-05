import React from 'react';
import PropTypes from 'prop-types';

function TableHeaderCell(props) {
  const { column, columnWidthMap, style } = props;
  const { name, key } = column;
  const setWidth = key === 'index' ? columnWidthMap[key] : columnWidthMap[name];
  const width = setWidth || column.width || 80;

  if (key === 'index') {
    return (
      <div className="page-design-table-display-cell index" style={{ ...style, width }}></div>
    );
  }
  return (
    <div className="page-design-table-display-cell page-design-table-column" style={{ ...style, width }}>
      <div className="w-100 h-100 d-flex align-items-center o-hidden">{name}</div>
    </div>
  );
}

TableHeaderCell.propTypes = {
  column: PropTypes.object.isRequired,
  columnWidthMap: PropTypes.object.isRequired,
  style: PropTypes.object,
};

export default TableHeaderCell;
