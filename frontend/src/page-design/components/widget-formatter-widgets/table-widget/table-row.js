import React from 'react';
import PropTypes from 'prop-types';
import TableRowCell from './table-row-cell';

function TableRow(props) {
  const { index, columns, row, currentTableId, collaborators, columnWidthMap,
    rowHeight, rowHeightValue, style, cellStyle, value, widget } = props;
  const lastColumnIndex = columns.length - 1;
  const { cellStyle: baseCellStyle, firstCellStyle, lastCellStyle } = cellStyle;

  return (
    <div
      className={`page-design-table-display-row page-design-table-display-row-${rowHeight}`}
      style={{ height: rowHeightValue ? rowHeightValue + 1 : 'auto', ...style }}
    >
      {columns.map((column, columnIndex) => {
        const { key, type } = column;
        const cellValue = type === 'index' ? index + 1 : row[key];
        let validCellStyle = baseCellStyle;
        if (columnIndex === 0) {
          validCellStyle = { ...validCellStyle, ...firstCellStyle };
        }
        if (columnIndex === lastColumnIndex) {
          validCellStyle = { ...validCellStyle, ...lastCellStyle };
        }
        return (
          <TableRowCell
            key={`${index}-${column.key}`}
            index={index}
            columnWidthMap={columnWidthMap}
            rowHeight={rowHeight}
            column={column}
            cellValue={cellValue}
            currentTableId={currentTableId}
            collaborators={collaborators}
            style={validCellStyle}
            value={value}
            widget={widget}
          />
        );
      })}
    </div>
  );
}

TableRow.propTypes = {
  index: PropTypes.number.isRequired,
  rowHeight: PropTypes.string,
  rowHeightValue: PropTypes.number,
  columnWidthMap: PropTypes.object.isRequired,
  columns: PropTypes.array.isRequired,
  row: PropTypes.object.isRequired,
  currentTableId: PropTypes.string.isRequired,
  collaborators: PropTypes.array,
  style: PropTypes.object,
  cellStyle: PropTypes.object.isRequired,
  value: PropTypes.object,
  widget: PropTypes.object,
};

export default TableRow;
