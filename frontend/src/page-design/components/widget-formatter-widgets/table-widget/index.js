import React from 'react';
import PropTypes from 'prop-types';
import { getDisplayColumns } from '../../../utils/widget-utils';
import { getTableWidgetStyle } from '../../../utils/style-utils';
import TableHeader from './table-header';
import TableRow from './table-row';
import { TABLE_ROW_HEIGHT_TYPE } from '../../../constants';

function TableWidget(props) {
  const { className, widget, rows, table, collaborators, value, view } = props;
  const configData = widget.config_data || {};
  const columns = getDisplayColumns(table, widget, configData.showRowNumber, view);
  const {
    titleStyle,
    rowFontStyle,
    rowStyle,
    cellStyle,
    firstRowStyle,
    lastRowStyle,
    firstCellStyle,
    lastCellStyle } = getTableWidgetStyle(widget);
  const { columnWidthMap } = configData.columns || {};
  const { width, height } = widget.layout_data || {};
  const { rowHeight, rowHeightValue } = rowStyle;
  const defaultRowsCount = parseInt((height - (titleStyle.height || 0)) / (rowHeightValue + 1)) + 1;
  const { showRowStart = 0, showRowEnd = undefined, applyBandedTableDesign } = widget.config_data || {};
  const displayRowsStart = showRowStart || 0;
  const displayRowsEnd = showRowEnd || defaultRowsCount;
  const displayRows = rows.slice(displayRowsStart, displayRowsEnd);
  const lastDisplayRowIndex = displayRows.length - 1;
  if (lastDisplayRowIndex < 0) return null;

  let displayColumns = [];
  let restWidth = width;
  let totalColumnsWidth = 0;
  for (let i = 0; i < columns.length; i++) {
    if (restWidth < 0) continue;
    const column = columns[i];
    const { name, width } = column;
    const columnWidth = columnWidthMap[name] || width || 80;
    restWidth -= columnWidth;
    totalColumnsWidth += columnWidth;
    displayColumns.push(column);
  }

  const displayColumnsCount = displayColumns.length;
  let newColumnWidthMap = { ...columnWidthMap };
  if (totalColumnsWidth > width) {
    const lastColumn = displayColumns[displayColumnsCount - 1];
    newColumnWidthMap[lastColumn.name] = lastColumn.width - (totalColumnsWidth - width);
  }

  let rowsStyle = { ...rowFontStyle };
  if (rowHeight === TABLE_ROW_HEIGHT_TYPE.AUTO) {
    const layoutData = widget.layout_data || {};
    const { height } = layoutData;
    rowsStyle['height'] = height - (titleStyle.height || 0);
  }

  return (
    <div className={`${className} page-design-table`}>
      <div className={`page-design-table-display page-design-table-display-${rowHeight}`}>
        <TableHeader
          isShow={configData.titleStyle ? configData.titleStyle.is_show : true}
          columns={displayColumns}
          columnWidthMap={newColumnWidthMap}
          style={{ titleStyle, rowStyle, cellStyle, firstRowStyle, firstCellStyle, lastCellStyle }}
        />
        <div className="page-design-table-rows" style={rowsStyle}>
          {displayRows.map((row, index) => {
            const rowId = row._id;
            let style = { ...rowStyle };
            if (index === lastDisplayRowIndex) {
              style = { ...style, ...lastRowStyle };
            }
            if (index % 2 === 1 && applyBandedTableDesign) {
              style['backgroundColor'] = '#f0f0f0';
            }
            return (
              <TableRow
                key={rowId}
                index={displayRowsStart + index}
                columnWidthMap={newColumnWidthMap}
                rowHeight={rowHeight}
                rowHeightValue={rowHeightValue}
                columns={displayColumns}
                row={row}
                currentTableId={table._id}
                collaborators={collaborators}
                style={style}
                cellStyle={{ cellStyle, firstCellStyle, lastCellStyle }}
                value={value}
                widget={widget}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

TableWidget.propTypes = {
  className: PropTypes.string,
  widget: PropTypes.object,
  rows: PropTypes.array.isRequired,
  table: PropTypes.object.isRequired,
  collaborators: PropTypes.array,
  value: PropTypes.object,
  view: PropTypes.object,
};

export default TableWidget;
