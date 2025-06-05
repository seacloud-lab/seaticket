import React from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import {
  FILTER_PREDICATE_TYPE,
  FILTER_COLUMN_OPTIONS,
  filterTermModifierNotWithin,
  filterTermModifierIsWithin,
  CellType,
  FILL_DEFAULT_VALUE_COLUMNS_TYPE,
  formatStringToNumber,
} from 'dtable-utils';
import { FormGroup } from 'reactstrap';
import { LongTextEditorDialog } from '@seafile/seafile-editor';
import { DTableRadio, DTableSwitch, toaster } from 'dtable-ui-component';
import FormLabel from '../../../components-form/form-label';
import FormEditorGenerator from '../../../components-form/form-editor-generator';
import { OPTIONS_SHOW_TYPE } from '../../../constants/form-constants';
import DateDefaultValue from '../../../components-form/cell-editor-widgets/date-default-value';
import EditRowItemFilters from './edit-row-item-filters';
import { isFilterTermArray } from '../../../utils/filters-utils';
import { isLongTextValueExceedLimit, isWeiXinBuiltInBrowser } from '../../../components-form/utils/utils';
import LongTextEditorUtils from '../../../components-form/utils/long-text-editor-utils';

const { workspaceID, token, dtableWebURL } = window.shared.pageOptions;
const gettext = window.gettext;

const propTypes = {
  isReadOnly: PropTypes.bool,
  column: PropTypes.object.isRequired,
  row: PropTypes.object.isRequired,
  currentColumns: PropTypes.array.isRequired,
  filters: PropTypes.array.isRequired,
  validFilters: PropTypes.array.isRequired,
  filteredColumns: PropTypes.array.isRequired,
  onColumnChanged: PropTypes.func.isRequired,
  enableReadOnly: PropTypes.bool,
  onColumnRequiredChanged: PropTypes.func,
};

class EditRowItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      description: props.column.description || '',
      isShowLongTextEditor: false,
    };
  }

  _isWeiXinBuiltInBrowser = isWeiXinBuiltInBrowser();

  _editorUtils = new LongTextEditorUtils({
    editorType: 'column-description',
    token,
    dtableWebURL,
    workspaceID,
    apiUploadLinkName: 'getPublicUploadLinkViaFormToken'
  });

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.column.description !== this.state.description) {
      this.setState({
        description: nextProps.column.description
      });
    }
  }

  onChange = (e) => {
    this.setState({ description: e.target.value });
  };

  isLongTextValueValid = (value) => {
    if (isLongTextValueExceedLimit(value)) {
      const message = gettext('The content of the document has exceeded the limit of 100000 characters, and the content cannot be saved');
      toaster.closeAll();
      toaster.danger(message, { duration: null });
      return false;
    }
    return true;
  };

  onSaveEditorValue = (value) => {
    if (!this.isLongTextValueValid(value)) return;
    let { column } = this.props;
    let description = value.text;
    if (description !== column.description) {
      this.props.onColumnChanged(column.key, { description });
    }
  };

  onCloseEditorDialog = (value) => {
    // value has no changed, no need to save
    if (!value) {
      this.setState({ isShowLongTextEditor: false });
      return;
    }
    // value is changed and value is valid
    if (this.isLongTextValueValid(value)) {
      this.onSaveEditorValue(value);
      this.setState({ isShowLongTextEditor: false });
      return;
    }
    // value is invalid
    // nothing todo
  };

  onBlur = () => {
    let { column } = this.props;
    let description = this.state.description;
    if (description !== column.description) {
      this.props.onColumnChanged(column.key, { description });
    }
  };

  onRequiredChanged = () => {
    let { column } = this.props;
    this.props.onColumnRequiredChanged(column.key, { is_required: !column.is_required });
  };

  toggleLongTextEditor = () => {
    this.setState({ isShowLongTextEditor: !this.state.isShowLongTextEditor });
  };

  getDefaultFilter = (columns = []) => {
    let defaultColumn = columns[columns.length - 1];
    if (!defaultColumn) {
      return {};
    }
    let { key: columnKey, type: columnType } = defaultColumn;
    let { filterPredicateList } = FILTER_COLUMN_OPTIONS[columnType];
    let filterPredicate = filterPredicateList[0];
    let filter = {
      column_key: columnKey,
      filter_predicate: filterPredicate,
      filter_term: '',
      filter_term_modifier: '',
    };

    if (columnType === CellType.CHECKBOX) {
      filter.filter_term = false;
    } else if (isFilterTermArray(defaultColumn, filterPredicate)) {
      filter.filter_term = [];
    } else if (columnType === CellType.DATE) {
      let filterTermModifier = filterPredicate === FILTER_PREDICATE_TYPE.IS_WITHIN ? filterTermModifierIsWithin[0] : filterTermModifierNotWithin[0];
      filter.filter_term_modifier = filterTermModifier;
    }
    return filter;
  };

  onShowOnConditionChange = () => {
    let { column, filteredColumns, validFilters } = this.props;
    let showOnCondition = validFilters.length > 0;
    let updated = { show_on_condition: !showOnCondition };
    if (showOnCondition) {
      updated['filters'] = [];
    } else {
      let filter = this.getDefaultFilter(filteredColumns);
      updated['filters'] = [filter];
    }
    this.props.onColumnChanged(column.key, updated);
  };

  onScanCodeEntryChange = () => {
    const { column } = this.props;
    const { key, enable_scan_code_entry } = column;
    let update = { enable_scan_code_entry: !enable_scan_code_entry };
    this.props.onColumnChanged(key, update);
  };

  onSetDefaultValueChange = () => {
    const { column } = this.props;
    const { key, enable_fill_default_value } = column;
    let update = { enable_fill_default_value: !enable_fill_default_value };
    if (!enable_fill_default_value) {
      update['default_value'] = '';
      update['enable_not_change_default_value'] = false;
    }
    this.props.onColumnChanged(key, update);
  };

  defaultValueChange = (update) => {
    const { column } = this.props;
    const { key, type, data } = column;
    if (type === CellType.NUMBER) {
      this.props.onColumnChanged(key, { default_value: formatStringToNumber(update[key], data) });
      return;
    }
    this.props.onColumnChanged(key, { default_value: update[key] });
  };

  onCanChangeDefaultValueChange = () => {
    const { column } = this.props;
    const { key, enable_not_change_default_value } = column;
    this.props.onColumnChanged(key, { enable_not_change_default_value: !enable_not_change_default_value });
  };

  onSetCheckedChange = () => {
    const { column } = this.props;
    const { key, require_fill_checked } = column;
    this.props.onColumnRequiredChanged(key, { require_fill_checked: !require_fill_checked });
  };

  onShowOptionsTypeChange = (optionsShowType) => {
    let { column } = this.props;
    this.props.onColumnChanged(column.key, { options_show_type: optionsShowType });
  };

  addFilter = () => {
    let { column, filteredColumns, filters } = this.props;
    let filter = this.getDefaultFilter(filteredColumns);
    filters.push(filter);
    this.props.onColumnChanged(column.key, { filters });
  };

  updateFilters = (filters) => {
    let { column, currentColumns } = this.props;
    let updated = { filters };
    if (filters.length === 0
      || filters.every(item => currentColumns.findIndex(column => item.column_key === column.key) < 0)) {
      updated = Object.assign({}, updated, { show_on_condition: false });
    }
    this.props.onColumnChanged(column.key, updated);
  };

  updateFilterConjunction = (filterConjunction) => {
    let { column } = this.props;
    this.props.onColumnChanged(column.key, { filter_conjunction: filterConjunction });
  };

  onSetReadOnly = () => {
    const { column } = this.props;
    const { key, permission } = column;
    const update = { permission: permission === 'r' ? 'rw' : 'r' };
    this.props.onColumnChanged(key, update);
  };

  renderDefaultValueContent = () => {
    const { row, column, currentColumns } = this.props;
    let {
      enable_fill_default_value: enableFillDefaultValue,
      default_value: defaultValue,
      enable_not_change_default_value: enableNotChangeDefaultValue,
    } = column;
    if (column.type === CellType.DATE) {
      return (
        <DateDefaultValue
          key={column.key}
          column={column}
          row={row}
          currentColumns={currentColumns}
          onCommit={this.defaultValueChange}
          onColumnChanged={this.props.onColumnChanged}
        />
      );
    }
    return (
      <div className="editing-default-value-content">
        <FormEditorGenerator
          isReadOnly={enableNotChangeDefaultValue}
          isSubmitting={enableFillDefaultValue && enableNotChangeDefaultValue}
          column={column}
          value={defaultValue}
          row={row || {}}
          columns={currentColumns}
          onCommit={this.defaultValueChange}
          isEditFormPage={true}
        />
      </div>
    );
  };

  render() {
    let { isReadOnly, column, currentColumns, filteredColumns, filters, validFilters, row, enableReadOnly } = this.props;
    let { isShowLongTextEditor } = this.state;
    let {
      key: columnKey,
      permission,
      show_on_condition: showOnCondition,
      filter_conjunction: filterConjunction,
      type: columnType,
      options_show_type: optionsShowType,
      enable_fill_default_value: enableFillDefaultValue,
      default_value: defaultValue,
      enable_not_change_default_value: enableNotChangeDefaultValue,
      enable_scan_code_entry: enableScanCodeEntry,
      require_fill_checked: requireFillChecked,
    } = column;
    optionsShowType = optionsShowType || OPTIONS_SHOW_TYPE.DROPDOWN;
    let showTypeIsList = optionsShowType === OPTIONS_SHOW_TYPE.LIST;
    return (
      <div className="form_mode compose-editor setting-row-item editing-setting-row-item">
        <div className="editing-cell-label-container">
          <FormLabel column={column} />
          {CellType.CHECKBOX !== column.type &&
            <DTableSwitch
              switchClassName={'editing-form-setting-item'}
              checked={column.is_required}
              onChange={this.onRequiredChanged}
              placeholder={gettext('Required')}
            />
          }
        </div>
        <div className="editing-row-content">
          <textarea
            className="row-description-content"
            value={this.state.description}
            onChange={this.onChange}
            onBlur={this.onBlur}
            placeholder={gettext('Add some help text')}
          />
          {!this._isWeiXinBuiltInBrowser &&
            <MediaQuery query="(min-width: 768px)">
              <span onClick={this.toggleLongTextEditor}>{gettext('Use rich text in help text')}</span>
            </MediaQuery>
          }
          {isShowLongTextEditor && (
            <LongTextEditorDialog
              headerName={gettext('Help text')}
              value={this.state.description}
              editorApi={this._editorUtils}
              onSaveEditorValue={this.onSaveEditorValue}
              onCloseEditorDialog={this.onCloseEditorDialog}
            />
          )}
          <div>
            <FormEditorGenerator
              isReadOnly={isReadOnly}
              isSubmitting={enableFillDefaultValue && enableNotChangeDefaultValue}
              value={enableFillDefaultValue ? defaultValue : undefined}
              column={column}
              row={row}
              columns={currentColumns}
              onCommit={() => {}}
              isEditFormPage={true}
            />
          </div>
        </div>
        <div className="editing-condition-container">
          {(columnType === CellType.SINGLE_SELECT || columnType === CellType.MULTIPLE_SELECT) && (
            <div className="show-options-type">
              <span className="show-options-text">{gettext('Show field as')}</span>
              <div className="show-type-content">
                <FormGroup check className={`show-type-item ${!showTypeIsList ? 'type-selected' : ''}`}>
                  <DTableRadio
                    isChecked={!showTypeIsList}
                    onCheckedChange={() => this.onShowOptionsTypeChange(OPTIONS_SHOW_TYPE.DROPDOWN)}
                    label={gettext('Dropdown')}
                    name="show-type"
                  />
                </FormGroup>
                <FormGroup check className={`show-type-item ${showTypeIsList ? 'type-selected' : ''}`}>
                  <DTableRadio
                    isChecked={showTypeIsList}
                    onCheckedChange={() => this.onShowOptionsTypeChange(OPTIONS_SHOW_TYPE.LIST)}
                    label={gettext('List')}
                    name="show-type"
                  />
                </FormGroup>
              </div>
            </div>
          )}
          <div className="filter-switch-content" id={`show-on-condition-${columnKey}`}>
            <DTableSwitch
              switchClassName={'editing-form-filter-switch'}
              checked={validFilters.length > 0}
              onChange={this.onShowOnConditionChange}
              placeholder={gettext('Show field only when conditions are met')}
            />
          </div>
          {showOnCondition && (
            <>
              <EditRowItemFilters
                filters={filters}
                filterConjunction={filterConjunction}
                filteredColumns={filteredColumns}
                currentColumns={currentColumns}
                updateFilters={this.updateFilters}
                updateFilterConjunction={this.updateFilterConjunction}
              />
              <div className="editing-form-add-filter" onClick={this.addFilter}>
                <i className="dtable-font dtable-icon-add-table"></i>
                <span className="add-new-option">{gettext('Add a filter')}</span>
              </div>
            </>
          )}
        </div>
        {columnType === CellType.TEXT &&
          <div className="editing-default-value">
            <div className="editing-default-value-switch">
              <DTableSwitch
                switchClassName={'editing-form-filter-switch'}
                checked={enableScanCodeEntry}
                onChange={this.onScanCodeEntryChange}
                placeholder={gettext('Support input by scanning barcode or QR code')}
              />
            </div>
          </div>
        }
        {FILL_DEFAULT_VALUE_COLUMNS_TYPE.includes(columnType) && (
          <div className="editing-default-value">
            <div className="editing-default-value-switch">
              <DTableSwitch
                switchClassName={'editing-form-filter-switch'}
                checked={enableFillDefaultValue}
                onChange={this.onSetDefaultValueChange}
                placeholder={gettext('Set default value')}
              />
            </div>
            {enableFillDefaultValue && (
              <>
                {this.renderDefaultValueContent()}
                {columnType === CellType.TEXT && (
                  <div className="editing-default-value-tip placeholder">
                    {gettext('Use {creator.name} or {creator.id} to fill with submitter\'s name or ID if the submitter is a registered user.')}
                  </div>
                )}
                <div className="editing-default-value-change-switch">
                  <DTableSwitch
                    switchClassName={'editing-form-filter-switch'}
                    checked={enableNotChangeDefaultValue}
                    onChange={this.onCanChangeDefaultValueChange}
                    placeholder={gettext('After setting the default value, the default value can not be changed')}
                  />
                </div>
              </>
            )}
          </div>
        )}
        {columnType === CellType.CHECKBOX &&
          <div className="editing-default-value">
            <div className="editing-default-value-switch">
              <DTableSwitch
                switchClassName={'editing-form-filter-switch'}
                checked={requireFillChecked}
                onChange={this.onSetCheckedChange}
                placeholder={gettext('Enforce check')}
              />
            </div>
          </div>
        }
        {enableReadOnly &&
          <div className="editing-default-value">
            <div className="editing-default-value-switch">
              <DTableSwitch
                switchClassName={'editing-form-filter-switch'}
                checked={permission === 'r'}
                onChange={this.onSetReadOnly}
                placeholder={gettext('Read-Only')}
              />
            </div>
          </div>
        }
      </div>
    );
  }
}

EditRowItem.propTypes = propTypes;

export default EditRowItem;
