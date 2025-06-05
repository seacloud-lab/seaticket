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
  ImageFormatter,
  FileFormatter,
  LongTextFormatter,
  GeolocationFormatter,
  CTimeFormatter,
  MTimeFormatter,
  AutoNumberFormatter,
  UrlFormatter,
  EmailFormatter,
  DurationFormatter,
  RateFormatter,
  ButtonFormatter,
  CreatorFormatter,
  LastModifierFormatter,
  DepartmentSingleSelectFormatter,
} from 'dtable-ui-component';
import { CellType } from 'dtable-utils';
import FormulaFormatter from './formula-formatter';
import LinkFormatter from './link-formatter';

const propTypes = {
  isSample: PropTypes.bool,
  isRowExpand: PropTypes.bool,
  column: PropTypes.object.isRequired,
  cellValue: PropTypes.oneOfType([PropTypes.string, PropTypes.bool, PropTypes.number, PropTypes.string, PropTypes.object, PropTypes.array]),
  collaborators: PropTypes.array,
  departments: PropTypes.array,
  empty: PropTypes.object,
  getUserCommonInfo: PropTypes.func,
  getOptionColors: PropTypes.func,
  queryUsers: PropTypes.func,
};

class Formatter extends React.Component {

  renderEmptyFormatter = () => {
    const { empty } = this.props;
    const { component } = empty || {};
    if (component) return component;
    return <span className="row-cell-value-empty"></span>;
  };

  downloadImage = (url) => {
    let seafileFileIndex = url.indexOf('seafile-connector');
    if (seafileFileIndex > -1) return;
    window.location.href = url + '?dl=1';
  };

  renderFormatter = () => {
    let { column, cellValue, collaborators, isSample, isRowExpand, departments } = this.props;
    const { type: columnType } = column || {};
    const containerClassName = `dtable-dataset-${columnType}-formatter`;

    switch (columnType) {
      case CellType.TEXT: {
        if (!cellValue) return this.renderEmptyFormatter();
        return <TextFormatter value={cellValue} containerClassName={containerClassName} />;
      }
      case CellType.COLLABORATOR: {
        if (!Array.isArray(cellValue) || cellValue.length === 0) return this.renderEmptyFormatter();
        cellValue = cellValue.filter(item => item);
        if (cellValue.length === 0) return this.renderEmptyFormatter();
        this.props.queryUsers(cellValue);
        return <CollaboratorFormatter value={cellValue} collaborators={collaborators} containerClassName={containerClassName} />;
      }
      case CellType.LONG_TEXT: {
        if (!cellValue) return this.renderEmptyFormatter();
        return <LongTextFormatter isSample={!isRowExpand} value={cellValue} containerClassName={containerClassName} />;
      }
      case CellType.IMAGE: {
        if (!cellValue || (Array.isArray(cellValue) && cellValue.length === 0)) return this.renderEmptyFormatter();
        return (
          <ImageFormatter
            value={cellValue}
            containerClassName={containerClassName}
            isSample={isSample}
            isSupportPreview={true}
            readOnly={true}
            downloadImage={this.downloadImage}
          />
        );
      }
      case CellType.FILE: {
        if (!cellValue || (Array.isArray(cellValue) && cellValue.length === 0)) return this.renderEmptyFormatter();
        return <FileFormatter value={cellValue} containerClassName={containerClassName} isSample={isSample} />;
      }
      case CellType.GEOLOCATION : {
        if (!cellValue) return this.renderEmptyFormatter();
        return <GeolocationFormatter value={cellValue} data={column.data || {}} containerClassName={containerClassName} />;
      }
      case CellType.NUMBER: {
        if (!cellValue && cellValue !== 0) return this.renderEmptyFormatter();
        return <NumberFormatter value={cellValue} data={column.data || {}} containerClassName={containerClassName} />;
      }
      case CellType.DATE: {
        if (!cellValue || typeof cellValue !== 'string') return this.renderEmptyFormatter();
        const { data } = column;
        const { format } = data || {};
        return <DateFormatter value={cellValue} format={format} containerClassName={containerClassName} />;
      }
      case CellType.MULTIPLE_SELECT: {
        if (!cellValue || cellValue.length === 0) return this.renderEmptyFormatter();
        const { data } = column;
        const { options } = data || {};
        return <MultipleSelectFormatter value={cellValue} options={options || []} containerClassName={containerClassName} />;
      }
      case CellType.SINGLE_SELECT: {
        if (!cellValue) return this.renderEmptyFormatter();
        const { data } = column;
        const { options } = data || {};
        return <SingleSelectFormatter value={cellValue} options={options || []} containerClassName={containerClassName} />;
      }
      case CellType.DEPARTMENT_SINGLE_SELECT: {
        if (!cellValue) return this.renderEmptyFormatter();
        return <DepartmentSingleSelectFormatter value={cellValue} departments={departments || []} />;
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
        this.props.queryUsers([cellValue]);
        return <CreatorFormatter collaborators={collaborators} value={cellValue} />;
      }
      case CellType.LAST_MODIFIER: {
        this.props.queryUsers([cellValue]);
        return <LastModifierFormatter collaborators={collaborators} value={cellValue} />;
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
      case CellType.RATE: {
        return <RateFormatter value={cellValue} data={column.data || {}} containerClassName={containerClassName}/>;
      }
      case CellType.BUTTON: {
        return <ButtonFormatter data={column.data || {}} containerClassName={containerClassName} optionColors={this.props.getOptionColors()}/>;
      }
      case CellType.FORMULA:
      case CellType.LINK_FORMULA: {
        return (
          <FormulaFormatter
            value={cellValue}
            column={column}
            collaborators={collaborators}
            containerClassName={containerClassName}
            queryUsers={this.props.queryUsers}
            renderEmptyFormatter={this.renderEmptyFormatter}
          />
        );
      }
      case CellType.LINK: {
        if (!Array.isArray(cellValue) || cellValue.length === 0) return this.renderEmptyFormatter();

        return (
          <LinkFormatter
            value={cellValue}
            column={column}
            collaborators={collaborators}
            containerClassName={containerClassName}
            renderEmptyFormatter={this.renderEmptyFormatter}
            getOptionColors={this.props.getOptionColors}
            getUserCommonInfo={this.props.getUserCommonInfo}
            queryUsers={this.props.queryUsers}
          />
        );
      }
      default:
        return this.renderEmptyFormatter();
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

Formatter.propTypes = propTypes;

Formatter.defaultProps = {
  isSample: false,
  isRowExpand: false,
  queryUsers: () => {},
};

export default Formatter;
