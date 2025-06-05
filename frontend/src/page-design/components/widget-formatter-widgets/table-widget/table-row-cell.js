import React from 'react';
import PropTypes from 'prop-types';
import { CellType, SELECT_OPTION_COLORS } from 'dtable-utils';
import { ButtonFormatter } from 'dtable-ui-component';
import { TABLE_ROW_HEIGHT_TYPE } from '../../../constants';
import CellFormatter from '../index';

function TableRowCell(props) {
  const { column, cellValue, currentTableId, collaborators, columnWidthMap, rowHeight, style, value, widget } = props;
  const { type, data, name, key } = column;
  const setWidth = key === 'index' ? columnWidthMap[key] : columnWidthMap[name];
  const width = setWidth || column.width || 80;
  const isRowHeightAuto = rowHeight === TABLE_ROW_HEIGHT_TYPE.AUTO;
  if (type === 'index') {
    return (
      <div className="page-design-table-display-cell index" style={{ ...style, width }}>
        {isRowHeightAuto ? (
          <div style={{ width: width - 18 }}>
            {cellValue}
          </div>
        ) : cellValue}
      </div>
    );
  }

  const className = `page-design-table-display-cell value page-design-table-display-${type}-cell`;

  if (type === CellType.BUTTON) {
    return (
      <div className={className} style={{ ...style, width }}>
        <ButtonFormatter
          data={data || {}}
          containerClassName={'page-design-table-button-formatter'}
          optionColors={SELECT_OPTION_COLORS}
        />
      </div>
    );
  }

  if (type === CellType.IMAGE) {
    const images = Array.isArray(cellValue) && cellValue.length > 0 ? cellValue.map((item, index) => {
      return (<img key={index} className="image-item" src={item} alt="" />);
    }) : [];
    return (
      <div className={className} style={{ ...style, width }}>
        {isRowHeightAuto ? (
          <div
            className={`dtable-ui cell-formatter-container image-formatter page-design-${type}-formatter`}
            style={{ width: width - 17 }}
          >
            {images}
          </div>
        ) : images}
      </div>
    );
  }

  return (
    <div className={className} style={{ ...style, width }}>
      {isRowHeightAuto ? (
        <div style={{ width: width - 17 }}>
          <CellFormatter
            isSample={false}
            column={column}
            widget={widget}
            cellValue={cellValue}
            currentTableId={currentTableId}
            collaborators={collaborators}
            value={value}
            components={{
              EmptyComponent: null,
            }}
          />
        </div>
      ) : (
        <CellFormatter
          isSample={false}
          column={column}
          widget={widget}
          cellValue={cellValue}
          currentTableId={currentTableId}
          collaborators={collaborators}
          value={value}
          components={{
            EmptyComponent: null,
          }}
        />
      )}
    </div>
  );
}

TableRowCell.propTypes = {
  value: PropTypes.object,
  index: PropTypes.number.isRequired,
  columnWidthMap: PropTypes.object.isRequired,
  rowHeight: PropTypes.string.isRequired,
  column: PropTypes.object.isRequired,
  cellValue: PropTypes.any,
  currentTableId: PropTypes.string.isRequired,
  collaborators: PropTypes.array,
  style: PropTypes.object,
  widget: PropTypes.object,
};

export default TableRowCell;
