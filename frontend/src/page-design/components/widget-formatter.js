import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { LINK_TABLE, TABLE_TYPES } from '../constants';
import { getImageStyle, getWidgetStyle, getDeleteWidgetWidget } from '../utils/style-utils';
import { isImageColumn } from '../utils/common-utils';
import CellFormatter from './widget-formatter-widgets';
import FileWidget from './widget-formatter-widgets/file-widget';
import LongTextWidget from './widget-formatter-widgets/long-text-widget';
import FormulaWidget from './widget-formatter-widgets/formula-widget';
import LinkTextWidget from './widget-formatter-widgets/link-text-widget';
import TableWidget from './widget-formatter-widgets/table-widget';

function WidgetFormatter(props) {
  const { widget, activeTable, activeView, viewRows, cellValue, column, widgetClassName, value, collaborators } = props;
  const { type } = column;
  const className = classnames('page-design-row-widget', widgetClassName, { 'd-flex': TABLE_TYPES.includes(widget.type) });
  if (type === 'deleted_column') {
    return (
      <div className={`delete ${className}`} style={getDeleteWidgetWidget(widget)}>
        {cellValue}
      </div>
    );
  }
  const style = isImageColumn(column) ? getImageStyle(widget, column, 1) : {};
  const widgetStyle = getWidgetStyle(widget);

  return (
    <div style={widgetStyle} className={className}>
      <CellFormatter
        column={column}
        cellValue={cellValue}
        style={style}
        currentTableId={activeTable._id}
        table={activeTable}
        view={activeView}
        viewRows={viewRows}
        value={value}
        collaborators={collaborators}
        widget={widget}
        components={{
          EmptyComponent: null,
          ImageComponent: FileWidget,
          FileComponent: FileWidget,
          LongTextComponent: LongTextWidget,
          LinkComponent: widget.type === LINK_TABLE ? TableWidget : LinkTextWidget,
          FormulaComponent: FormulaWidget,
          DigitalSignComponent: FileWidget,
        }}
      />
    </div>
  );
}

WidgetFormatter.propTypes = {
  widget: PropTypes.object,
  widgetClassName: PropTypes.string,
  cellValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool, PropTypes.array, PropTypes.object]),
  activeTable: PropTypes.object,
  activeView: PropTypes.object,
  viewRows: PropTypes.array,
  column: PropTypes.object,
  value: PropTypes.object,
  collaborators: PropTypes.array,
};

export default WidgetFormatter;
