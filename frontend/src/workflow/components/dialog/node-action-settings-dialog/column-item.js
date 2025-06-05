import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { CellType } from 'dtable-utils';
import { Input } from 'reactstrap';
import OptionUtils from '../../../../utils/option-utils';
import { NODE_ACTION_TIME_OPTION_TYPE, NODE_ACTION_TIME_OPTIONS } from '../../../constants';
import { DTableSelect, DTableCustomizeSelect } from 'dtable-ui-component';
import CollaboratorSelect from '../../select/collaborator-select';
import { gettext } from '../../../../utils/constants';
import editorMap from '../../cell-editor/editor-map';
import { CollaboratorOptionItem, Collaborator } from '../../common/collaborator';
import SingleSelectDropdownEditor from '../../../../components-form/cell-editor-widgets/single-select-editor/single-select-dropdown-editor';
import MultipleSelectDropdownEditor from '../../../../components-form/cell-editor-widgets/multiple-select-editor/multiple-select-dropdown-editor';

class FieldItem extends Component {

  constructor(props) {
    super(props);
    let { column, columnOptions, cellValue, workflowRelatedUsers } = props;
    const selectedColumnOption = columnOptions.find(option => option.value.column.key === column.key);
    this.timeOptions = OptionUtils.generatorKeyLabelOptions(NODE_ACTION_TIME_OPTIONS);
    this.collaborators = workflowRelatedUsers || [];
    let selectedTimeOption = this.timeOptions[0];
    let timeDays = 0;
    if (column.type === CellType.DATE) {
      const { offset, value } = cellValue;
      if (offset === 0) {
        selectedTimeOption = this.timeOptions[1];
      } else if (offset < 0) {
        selectedTimeOption = this.timeOptions[2];
        timeDays = -offset;
      } else if (offset > 0) {
        selectedTimeOption = this.timeOptions[3];
        timeDays = offset;
      } else if (offset === undefined) {
        cellValue = value || '';
      }
    }
    this.state = {
      selectedColumnOption,
      selectedTimeOption,
      cellValue,
      timeDays,
    };
    this.preClassName = 'node-action-update-record-field-item';
  }

  onUpdateColumn = () => {
    const { selectedColumnOption, selectedTimeOption, cellValue, timeDays } = this.state;
    const { value } = selectedColumnOption;
    const { column } = value;
    const { type, key } = column;
    const { index } = this.props;
    let newColumn = {
      key,
      value: cellValue
    };
    if (type === CellType.DATE) {
      let value = {};
      const { value: timeOptionValue } = selectedTimeOption;
      if (timeOptionValue === NODE_ACTION_TIME_OPTION_TYPE.SPECIFIC_DATE) {
        value = { value: cellValue, set_type: 'specific_value' };
      } else if (timeOptionValue === NODE_ACTION_TIME_OPTION_TYPE.CURRENT_DAY) {
        value = { offset: 0, set_type: 'relative_date', offset_by: 'day' };
      } else if (timeOptionValue === NODE_ACTION_TIME_OPTION_TYPE.BEFORE_DAYS) {
        value = { offset: -1 * timeDays, set_type: 'relative_date', offset_by: 'day' };
      } else if (timeOptionValue === NODE_ACTION_TIME_OPTION_TYPE.AFTER_DAYS) {
        value = { offset: timeDays * 1, set_type: 'relative_date', offset_by: 'day' };
      }
      newColumn = {
        key,
        value,
      };
    }
    this.props.onUpdateColumn(index, newColumn);
  };

  onDeleteColumn = () => {
    const { index } = this.props;
    this.props.onDeleteColumn(index);
  };

  updateColumn = (update = {}) => {
    this.setState(update, () => {
      this.onUpdateColumn();
    });
  };

  onSelectColumn = (selectedColumnOption) => {
    if (selectedColumnOption.value.column.key === this.state.selectedColumnOption.value.column.key) return;
    this.updateColumn({ selectedColumnOption, cellValue: '', timeDays: 0 });
  };

  onValueChange = (value) => {
    const { selectedColumnOption } = this.state;
    const selectedColumnKey = selectedColumnOption.value.column.key;
    const valueType = Object.prototype.toString.call(value);
    const cellValue = valueType === '[object Object]' ? value[selectedColumnKey] : value;
    this.updateColumn({ cellValue });
  };

  onCollaboratorsChanged = (email) => {
    const { cellValue } = this.state;
    let newCellValue = cellValue ? cellValue.slice(0, ) : [];
    const index = newCellValue.findIndex(item => item === email);
    if (index === -1) {
      const collaborator = this.collaborators.find(collaborator => collaborator.email === email);
      if (collaborator) {
        newCellValue.push(email);
      }
    } else {
      newCellValue.splice(index, 1);
    }
    this.updateColumn({ cellValue: newCellValue });
  };

  getCollaboratorOptions = () => {
    let selectedMap = {};
    const { cellValue } = this.state;
    if (Array.isArray(cellValue) && cellValue.length > 0) {
      cellValue.forEach(item => {
        selectedMap[item] = true;
      });
    }
    return this.collaborators.map(collaborator => {
      const { email, name, name_pinyin } = collaborator;
      return {
        label: (
          <CollaboratorOptionItem
            isSelected={selectedMap[email]}
            collaborator={collaborator}
          />
        ),
        value: email,
        name,
        name_pinyin,
      };
    });
  };

  onRemoveCollaborator = (event, email) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
    const { cellValue } = this.state;
    let newCellValue = cellValue.slice(0, );
    const cellValueIndex = newCellValue.findIndex(item => item === email);
    newCellValue.splice(cellValueIndex, 1);
    this.updateColumn({ cellValue: newCellValue });
  };

  getSelectedDisplayCollaborators = (collaborators) => {
    if (!Array.isArray(collaborators) || collaborators.length === 0) return [];
    return collaborators.map(email => {
      const collaborator = this.collaborators.find(item => item.email === email);
      if (!collaborator) return null;
      return (
        <Collaborator
          key={email}
          isShowRemove={true}
          collaborator={collaborator}
          onRemove={this.onRemoveCollaborator}
        />
      );
    });
  };

  onSelectTimeOption = (selectedTimeOptionValue) => {
    if (selectedTimeOptionValue === this.state.selectedTimeOption.value) return;
    const { timeDays } = this.state;
    let update = {
      cellValue: '',
      selectedTimeOption: this.timeOptions.find(option => option.value === selectedTimeOptionValue)
    };
    if (selectedTimeOptionValue !== NODE_ACTION_TIME_OPTION_TYPE.SPECIFIC_DATE) {
      update['timeDays'] = timeDays || 0;
    }
    this.updateColumn(update);
  };

  onTimeDaysChanged = (event) => {
    const value = event.target.value;
    if (value === this.state.timeDays) return;
    this.updateColumn({ timeDays: value });
  };

  renderTimeOptions = () => {
    const { selectedTimeOption } = this.state;
    return (
      <div className={`${this.preClassName}-select-column-content mr-4`} style={{ width: 'fit-content' }}>
        <DTableCustomizeSelect
          isInModal={true}
          options={this.timeOptions}
          value={selectedTimeOption}
          onSelectOption={this.onSelectTimeOption}
        />
      </div>
    );
  };

  renderValueItem = () => {
    const { selectedColumnOption } = this.state;
    const { value } = selectedColumnOption;
    const { column } = value;
    const { type } = column;
    const { cellValue } = this.state;
    const editorProps = {
      value: cellValue,
      column,
      row: {},
      columns: this.props.columns,
      onCommit: this.onValueChange,
    };
    const formControlName = 'd-flex align-items-center form-control';

    switch (type) {
      case CellType.COLLABORATOR: {
        return (
          <CollaboratorSelect
            supportMultipleSelect={true}
            searchable={true}
            isUsePopover={true}
            className="selector-collaborator form-control"
            placeholder={gettext('Select collaborators')}
            noOptionsPlaceholder={gettext('No collaborators')}
            searchPlaceholder={gettext('Select collaborators')}
            onSelectOption={this.onCollaboratorsChanged}
            value={{ label: this.getSelectedDisplayCollaborators(cellValue) }}
            options={this.getCollaboratorOptions()}
            top={-50}
          />
        );
      }
      case CellType.SINGLE_SELECT: {
        return (
          <div className={`${this.preClassName}-single-select-container ${formControlName} p-0`}>
            <SingleSelectDropdownEditor
              value={cellValue}
              column={column}
              onCommit={this.onValueChange}
              getOptions={() => {
                return column.data && column.data.options ? column.data.options : [];
              }}
            />
          </div>
        );
      }
      case CellType.MULTIPLE_SELECT: {
        return (
          <div className={`${this.preClassName}-single-select-container ${formControlName} p-0`}>
            <MultipleSelectDropdownEditor
              value={cellValue}
              column={column}
              onCommit={this.onValueChange}
            />
          </div>
        );
      }
      case CellType.RATE: {
        const Editor = editorMap[type];
        return (
          <div className={`${formControlName} pt-0 pb-0`}>
            {Editor && React.cloneElement(Editor, { ...editorProps, value: value ? parseInt(cellValue) : 0 })}
          </div>
        );
      }
      case CellType.CHECKBOX: {
        const Editor = editorMap[type];
        return (
          <div className={`${this.preClassName}-checkbox-container ${formControlName} p-0`}>
            {Editor && React.cloneElement(Editor, { ...editorProps })}
          </div>
        );
      }
      case CellType.DATE: {
        const Editor = editorMap[type];
        const { selectedTimeOption } = this.state;
        const selectedTimeValue = selectedTimeOption.value;
        const timeOptionDom = this.renderTimeOptions();
        if (selectedTimeValue === NODE_ACTION_TIME_OPTION_TYPE.SPECIFIC_DATE) {
          return (
            <div className="w-100 d-flex align-items-center">
              {timeOptionDom}
              {Editor && React.cloneElement(Editor, { ...editorProps })}
            </div>
          );
        }
        if (selectedTimeValue === NODE_ACTION_TIME_OPTION_TYPE.CURRENT_DAY) {
          return timeOptionDom;
        }
        return (
          <div className="w-100 d-flex align-items-center">
            {timeOptionDom}
            <Input
              type="number"
              min={0}
              className={`${this.preClassName}-time-days`}
              onChange={this.onTimeDaysChanged}
              value={this.state.timeDays}
            />
          </div>
        );
      }
      default: {
        const Editor = editorMap[type];
        return (
          <>
            {Editor && React.cloneElement(Editor, { ...editorProps })}
          </>
        );
      }
    }
  };

  render() {
    const { columnOptions, updates } = this.props;
    const { selectedColumnOption } = this.state;
    const validColumnOptions = columnOptions.filter(option => !updates.find(update => update.key === option.value.column.key));
    const selectedColumnOptionType = selectedColumnOption.value.column.type;

    return (
      <div className={`${this.preClassName} d-flex align-items-center w-100 mt-3 mb-3`}>
        <div className={`${this.preClassName}-delete`} onClick={this.onDeleteColumn}>
          <i className="dtable-font dtable-icon-fork-number"></i>
        </div>
        <div className={`${this.preClassName}-select-column-content mr-2`}>
          <DTableSelect
            options={validColumnOptions}
            value={selectedColumnOption}
            onChange={this.onSelectColumn}
            placeholder={gettext('Select column')}
            menuPortalTarget={'.workflow-node-action-settings-modal'}
            noOptionsMessage={() => {
              return <span>{gettext('No column')}</span>;
            }}
          />
        </div>
        <div className={`${this.preClassName}-set pl-4 pr-4`}>{gettext('Set to')}</div>
        <div className={`${this.preClassName}-value-container ${this.preClassName}-${selectedColumnOptionType}-value-container ml-2`}>
          {this.renderValueItem()}
        </div>
      </div>
    );
  }
}

FieldItem.propTypes = {
  column: PropTypes.object,
  cellValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array, PropTypes.object, PropTypes.bool]),
  index: PropTypes.number,
  columnOptions: PropTypes.array,
  updates: PropTypes.array,
  columns: PropTypes.array,
  currentTableID: PropTypes.string,
  workflowRelatedUsers: PropTypes.array,
  onDeleteColumn: PropTypes.func,
  onUpdateColumn: PropTypes.func,
};

export default FieldItem;
