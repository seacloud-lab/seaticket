import React from 'react';
import PropTypes from 'prop-types';
import TableHeaderCell from './table-header-cell';

function TableHeader(props) {
  const { columns, columnWidthMap, style, isShow } = props;
  const { titleStyle, rowStyle, cellStyle, firstRowStyle, firstCellStyle, lastCellStyle } = style || {};
  const lastColumnIndex = columns.length - 1;
  const width = columns.reduce((preciousValue, column) => preciousValue + (columnWidthMap[column.name] || column.width || 80), 0);
  const validStyle = { ...rowStyle, ...firstRowStyle, ...titleStyle, width };

  if (!isShow) {
    return (
      <div className="page-design-table-header o-hidden" style={validStyle}>
        <div className="page-design-table-display-row page-design-table-row-header"></div>
      </div>
    );
  }
  return (
    <div className="page-design-table-header o-hidden" style={{ ...validStyle }}>
      <div className={`page-design-table-display-row page-design-table-row-header page-design-table-display-row-${titleStyle.titleHeight}`}>
        {columns.map((column, columnIndex) => {
          let style = { ...cellStyle };
          if (columnIndex === 0) {
            style = { ...style, ...firstCellStyle };
          }
          if (columnIndex === lastColumnIndex) {
            style = { ...style, ...lastCellStyle };
          }
          return (
            <TableHeaderCell
              key={`-1-${column.key}`}
              column={column}
              columnWidthMap={columnWidthMap}
              style={style}
            />
          );
        })}
      </div>
    </div>
  );
}

TableHeader.propTypes = {
  isShow: PropTypes.bool,
  columns: PropTypes.array.isRequired,
  columnWidthMap: PropTypes.object.isRequired,
  style: PropTypes.object,
};

export default TableHeader;
