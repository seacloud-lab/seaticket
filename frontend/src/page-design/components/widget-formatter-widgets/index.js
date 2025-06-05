import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import {
  TextFormatter,
  NumberFormatter,
  CheckboxFormatter,
  DateFormatter,
  SingleSelectFormatter,
  MultipleSelectFormatter,
  CollaboratorFormatter,
  GeolocationFormatter,
  CTimeFormatter,
  MTimeFormatter,
  AutoNumberFormatter,
  UrlFormatter,
  EmailFormatter,
  DurationFormatter,
  RateFormatter,
  ButtonFormatter,
  LongTextFormatter,
  ImageFormatter,
  FileFormatter,
  FormulaFormatter,
  DigitalSignFormatter,
} from 'dtable-ui-component';
import { CellType, SELECT_OPTION_COLORS, getTableById, getViewById, getColumnOptions } from 'dtable-utils';
import { isValidDigitalSignImageValue } from 'dtable-ui-component/lib/DigitalSignFormatter/utils';
import FileWidget from './file-widget';
import { STATIC_CELL_TYPE, DYNAMIC_CELL_TYPE, VIEW_TYPE, PAGE_HEADER_FOOTER_TYPE, DISPLAY_TYPE } from '../../constants';
import TableWidget from './table-widget';
import PageHeaderFooterFormatter from './page-header-footer-formatter';
import CustomLastModifierFormatter from './last-modifier-formatter';
import CustomCreatorFormatter from './creator-formatter';
import LinkFormatter from './link-formatter-widget';

class CellFormatter extends React.Component {

  renderEmptyFormatter = () => {
    const { components } = this.props;
    const { emptyComponent } = components || {};
    return emptyComponent || null;
  };

  renderFormatter = () => {
    let { column, cellValue, collaborators, style, value, components, currentTableId, isSample, widget } = this.props;
    const { tables } = value;
    const { type: columnType } = column || {};
    const containerClassName = `page-design-${columnType}-pdf-formatter`;
    const { ImageComponent, FileComponent, LongTextComponent, LinkComponent, FormulaComponent, DigitalSignComponent } = components;

    switch (columnType) {
      case CellType.TEXT: {
        if (!cellValue) return this.renderEmptyFormatter();
        return <TextFormatter value={cellValue} containerClassName={containerClassName} />;
      }
      case CellType.COLLABORATOR: {
        if (!Array.isArray(cellValue) || cellValue.length === 0) return this.renderEmptyFormatter();
        cellValue = cellValue.filter(item => item);
        if (cellValue.length === 0) return this.renderEmptyFormatter();
        if (widget && widget.config_data.display_as === DISPLAY_TYPE.TEXT) {
          return cellValue.map(item => collaborators.find(c => c.email === item)?.name).filter(item => item).join(', ');
        }
        return <CollaboratorFormatter value={cellValue} collaborators={collaborators} containerClassName={containerClassName} />;
      }
      case CellType.LONG_TEXT: {
        if (!cellValue) return this.renderEmptyFormatter();
        if (LongTextComponent) {
          return <LongTextComponent value={cellValue} className={containerClassName} />;
        }
        const simpleLongTextValue = typeof cellValue === 'object' ? cellValue.text : cellValue;
        return <LongTextFormatter value={simpleLongTextValue} containerClassName={containerClassName} />;
      }
      case CellType.IMAGE: {
        if (!cellValue || (Array.isArray(cellValue) && cellValue.length === 0)) return this.renderEmptyFormatter();
        if (ImageComponent) {
          return cellValue.map(item => {
            return (
              <ImageComponent key={item} value={item} style={style} type={columnType} />
            );
          });
        }
        return <ImageFormatter value={cellValue} isSample={isSample} containerClassName={containerClassName}/>;
      }
      case CellType.FILE: {
        if (!cellValue || (Array.isArray(cellValue) && cellValue.length === 0)) return this.renderEmptyFormatter();
        if (FileComponent) {
          return cellValue.map((item, index) => {
            return (
              <FileComponent key={index} value={item} style={style} type={columnType} />
            );
          });
        }
        return <FileFormatter value={cellValue} isSample={isSample} containerClassName={containerClassName} />;
      }
      case CellType.GEOLOCATION : {
        if (!cellValue) return this.renderEmptyFormatter();
        return <GeolocationFormatter value={cellValue} containerClassName={containerClassName} />;
      }
      case CellType.NUMBER: {
        if (!cellValue && cellValue !== 0) return this.renderEmptyFormatter();
        return <NumberFormatter value={cellValue} data={column.data} containerClassName={containerClassName} />;
      }
      case CellType.DATE: {
        if (!cellValue) return this.renderEmptyFormatter();
        return <DateFormatter value={cellValue} format={column.data.format} containerClassName={containerClassName} />;
      }
      case CellType.MULTIPLE_SELECT: {
        if (!cellValue || cellValue.length === 0) return this.renderEmptyFormatter();
        const options = (column.data && column.data.options) || [];
        if (widget && widget.type === VIEW_TYPE.ALL_RECORDS_TABLE && widget.config_data.select_column_display_option_color === false) {
          const validOptions = options.filter(option => cellValue.includes(option.id));
          if (validOptions.length === 0) return this.renderEmptyFormatter();
          const displayValue = validOptions.map(option => option.name).join(' ');
          return <TextFormatter value={displayValue} containerClassName="page-design-text-pdf-formatter" />;
        }
        return <MultipleSelectFormatter value={cellValue} options={options} containerClassName={containerClassName} />;
      }
      case CellType.SINGLE_SELECT: {
        if (!cellValue) return this.renderEmptyFormatter();
        const options = getColumnOptions(column);
        const option = options.find(option => option.id === cellValue);
        if (widget && widget.config_data.display_as === DISPLAY_TYPE.TEXT) {
          const gettext = window.gettext;
          return option ? option.name : gettext('Deleted option');
        }
        if (widget && widget.type === VIEW_TYPE.ALL_RECORDS_TABLE && widget.config_data.select_column_display_option_color === false) {
          if (!option) return this.renderEmptyFormatter();
          return <TextFormatter value={option.name} containerClassName="page-design-text-pdf-formatter" />;
        }
        return <SingleSelectFormatter value={cellValue} options={options} containerClassName={containerClassName} />;
      }
      case CellType.CHECKBOX: {
        return <CheckboxFormatter value={cellValue} containerClassName={containerClassName} />;
      }
      case CellType.CTIME: {
        if (!cellValue) return this.renderEmptyFormatter();
        return <CTimeFormatter value={cellValue} containerClassName={containerClassName} />;
      }
      case CellType.MTIME: {
        if (!cellValue) return this.renderEmptyFormatter();
        return <MTimeFormatter value={cellValue} containerClassName={containerClassName} />;
      }
      case CellType.CREATOR: {
        return (
          <CustomCreatorFormatter cellValue={cellValue} collaborators={collaborators} containerClassName={containerClassName} />
        );
      }
      case CellType.LAST_MODIFIER: {
        return (
          <CustomLastModifierFormatter cellValue={cellValue} collaborators={collaborators} containerClassName={containerClassName} />
        );
      }
      case CellType.FORMULA:
      case CellType.LINK_FORMULA: {
        if (!cellValue && cellValue !== 0) return this.renderEmptyFormatter();
        if (FormulaComponent) {
          return (
            <FormulaComponent
              value={cellValue}
              column={column}
              collaborators={collaborators}
              currentTableId={currentTableId}
              style={style}
              tables={tables}
              renderEmptyFormatter={this.renderEmptyFormatter}
            />
          );
        }
        return <FormulaFormatter value={cellValue} column={column} collaborators={collaborators} containerClassName={containerClassName} />;
      }
      case CellType.LINK: {
        const { data } = column;
        if (!Array.isArray(cellValue) || cellValue.length === 0) return this.renderEmptyFormatter();
        const { link_id, table_id, other_table_id, display_column_key, is_row_from_view, other_view_id } = data;
        if (!link_id || !table_id || !other_table_id || !display_column_key) return this.renderEmptyFormatter();
        const linkedTableID = currentTableId === table_id ? other_table_id : table_id;
        const linkedTable = getTableById(tables, linkedTableID);
        if (!linkedTable) return this.renderEmptyFormatter();
        const { columns } = linkedTable;
        const linkedDisplayColumn = columns.find(column => column.key === display_column_key);
        if (!linkedDisplayColumn) return this.renderEmptyFormatter();
        const className = `dtable-ui cell-formatter-container link-formatter ${containerClassName}`;
        const linkedView = is_row_from_view ? getViewById(linkedTable.views, other_view_id) : null;
        if (LinkComponent) {
          return (
            <LinkComponent
              className={className}
              table={linkedTable}
              rows={cellValue}
              linkedDisplayColumn={linkedDisplayColumn}
              widget={widget}
              collaborators={collaborators}
              value={value}
              view={linkedView}
            />
          );
        }
        return (
          <LinkFormatter containerClassName={className} value={cellValue} tables={tables} column={linkedDisplayColumn} collaborators={collaborators} />
        );
      }
      case CellType.AUTO_NUMBER: {
        if (!cellValue) return this.renderEmptyFormatter();
        return <AutoNumberFormatter value={cellValue} containerClassName={containerClassName} />;
      }
      case CellType.URL: {
        if (!cellValue) return this.renderEmptyFormatter();
        return <UrlFormatter value={cellValue} containerClassName={containerClassName} />;
      }
      case CellType.EMAIL: {
        if (!cellValue) return this.renderEmptyFormatter();
        return <EmailFormatter value={cellValue} containerClassName={containerClassName} />;
      }
      case CellType.DURATION: {
        if (!cellValue) return this.renderEmptyFormatter();
        return <DurationFormatter value={cellValue} format={column.data.duration_format} containerClassName={containerClassName} />;
      }
      case STATIC_CELL_TYPE.STATIC_TEXT:
      case DYNAMIC_CELL_TYPE.CURRENT_DATE:
      case DYNAMIC_CELL_TYPE.PAGE_NUMBER:
      case DYNAMIC_CELL_TYPE.CURRENT_USER:
      case DYNAMIC_CELL_TYPE.TEMPLATE_NAME:
      case VIEW_TYPE.VIEW_NAME: {
        if (!cellValue) return this.renderEmptyFormatter();
        return cellValue;
      }
      case STATIC_CELL_TYPE.STATIC_IMAGE: {
        return <FileWidget value={cellValue} style={style} type={columnType} />;
      }
      case CellType.DIGITAL_SIGN: {
        if (DigitalSignComponent) {
          return (
            <DigitalSignComponent value={cellValue} style={style} type={columnType} />
          );
        }
        const value = isValidDigitalSignImageValue(cellValue);
        if (!value) return this.renderEmptyFormatter();
        const { serviceURL } = window.app.config;
        const { dtable_uuid, workspaceID } = window.app.pageOptions;
        return (
          <DigitalSignFormatter
            isSample={isSample}
            isSupportPreview={false}
            containerClassName={containerClassName}
            value={cellValue}
            config={{
              server: serviceURL,
              workspaceID: workspaceID,
              dtableUuid: dtable_uuid,
            }}
          />
        );
      }
      case CellType.RATE: {
        return <RateFormatter value={cellValue} data={column.data || {}} containerClassName={containerClassName}/>;
      }
      case CellType.BUTTON: {
        return <ButtonFormatter data={column.data || {}} containerClassName={containerClassName} optionColors={SELECT_OPTION_COLORS}/>;
      }
      case VIEW_TYPE.ALL_RECORDS_TABLE: {
        const className = `dtable-ui cell-formatter-container link-formatter ${containerClassName}`;
        const { table, viewRows, view } = this.props;
        return (
          <TableWidget
            className={className}
            table={table}
            rows={viewRows}
            widget={widget}
            collaborators={collaborators}
            value={value}
            view={view}
          />
        );
      }
      case PAGE_HEADER_FOOTER_TYPE.PAGE_HEADER:
      case PAGE_HEADER_FOOTER_TYPE.PAGE_FOOTER: {
        return (
          <PageHeaderFooterFormatter
            value={cellValue}
            widget={widget}
            containerClassName={containerClassName}
          />
        );
      }
      default:
        return null;
    }
  };

  render() {
    return (
      <Fragment>
        {this.renderFormatter()}
      </Fragment>
    );
  }
}

CellFormatter.propTypes = {
  value: PropTypes.object,
  currentTableId: PropTypes.string.isRequired,
  column: PropTypes.object.isRequired,
  cellValue: PropTypes.oneOfType([PropTypes.string, PropTypes.bool, PropTypes.number, PropTypes.string, PropTypes.object, PropTypes.array]),
  style: PropTypes.object,
  components: PropTypes.object,
  collaborators: PropTypes.array,
  widget: PropTypes.object,
  isSample: PropTypes.bool,
  table: PropTypes.object,
  view: PropTypes.object,
  viewRows: PropTypes.array,
};

CellFormatter.defaultProps = {
  isSample: true,
};

export default CellFormatter;
