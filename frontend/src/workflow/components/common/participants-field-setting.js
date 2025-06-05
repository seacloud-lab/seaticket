import React from 'react';
import PropTypes from 'prop-types';
import { Label, FormGroup } from 'reactstrap';
import { CellType } from 'dtable-utils';
import { DTableCustomizeSelect } from 'dtable-ui-component';
import AddParticipantsFieldDialog from '../dialog/add-participants-field-dialog';

const gettext = window.gettext;

class ParticipantsFieldSetting extends React.Component {

  constructor(props) {
    super(props);
    this.initOptions(props);
    const { workflowConfig } = props;
    const participantsColumnKey = workflowConfig.participants_column_key;
    this.state = {
      isShowNewOptionsDialog: false,
      selectedField: this.options.find(option => option.value === participantsColumnKey),
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.initOptions(nextProps);
    this.setState({
      selectedField: this.options.find(option => option.value === nextProps.workflowConfig.participants_column_key)
    });
  }

  initOptions = (props) => {
    const { workflowConfig, tables } = props;
    this.selectedTable = tables.find(table => table._id === workflowConfig.table_id);
    this.options = [];
    if (!this.selectedTable) {
      return;
    }
    this.selectedTable.columns.forEach(field => {
      if (field.type === CellType.COLLABORATOR) {
        this.options.push({
          label: (
            <>
              <i className="dtable-font dtable-icon-collaborator workflow-state-field-icon"></i>
              <span>{field.name}</span>
            </>
          ),
          key: field.key,
          value: field.key
        });
      }
    });
  };

  onSettingUpdate = (participants_column_key) => {
    const { workflowConfig } = this.props;
    if (participants_column_key === workflowConfig.participants_column_key) return;
    const selectedColumnOption = this.options.find(option => option.value === participants_column_key);
    if (!selectedColumnOption) return;
    workflowConfig.nodes = workflowConfig.nodes.map(node => {
      if (node.node_form && node.node_form.columns) {
        node.node_form.columns = node.node_form.columns.filter(col => col.key !== selectedColumnOption.value);
      }
      return node;
    });
    this.props.onSettingUpdate({
      participants_column_key: participants_column_key,
    });
  };

  toggleNewOptionsDialog = () => {
    this.setState({ isShowNewOptionsDialog: !this.state.isShowNewOptionsDialog });
  };

  submitNewParticipantsField = (fieldName) => {
    const that = this;
    this.props.onAddParticipantsField(fieldName, this.selectedTable.name, (field) => {
      field && that.onSettingUpdate(field.key);
    });
  };

  renderSelector = () => {
    const { isLocked, addOptionAble } = this.props;
    const { selectedField } = this.state;

    return (
      <DTableCustomizeSelect
        isLocked={isLocked}
        addOptionAble={addOptionAble}
        className="workflow-select-state-field"
        value={selectedField}
        options={this.options}
        noOptionsPlaceholder={gettext('No assignee fields')}
        component={{
          AddOption: (
            <div className="workflow-select-state-option-add" onClick={this.toggleNewOptionsDialog}>
              <i className="dtable-font dtable-icon-add-table"></i>
              <span>{gettext('Add new assignee field')}</span>
            </div>
          )
        }}
        onSelectOption={this.onSettingUpdate}
      />
    );
  };

  render() {
    const { title, className, addOptionAble } = this.props;
    const { isShowNewOptionsDialog } = this.state;

    return (
      <>
        <FormGroup key="workflow-state-field" className={`setting-item table-setting ${className || ''}`} >
          <Label className="d-flex align-items-center">
            {title || gettext('Assignee field')}
            {addOptionAble && <span className="cell-is-required">*</span>}
          </Label>
          <div className="workflow-state-field-tip mb-2">
            {gettext('This is used to record the assignees of tasks, it needs to be a collaborator field.')}
          </div>
          {this.renderSelector()}
        </FormGroup>
        {isShowNewOptionsDialog && (
          <AddParticipantsFieldDialog
            table={this.selectedTable}
            onToggle={this.toggleNewOptionsDialog}
            onSubmit={this.submitNewParticipantsField}
          />
        )}
      </>
    );
  }
}

ParticipantsFieldSetting.propTypes = {
  isLocked: PropTypes.bool,
  addOptionAble: PropTypes.bool,
  workflowConfig: PropTypes.object.isRequired,
  title: PropTypes.string,
  className: PropTypes.string,
  tables: PropTypes.array.isRequired,
  onSettingUpdate: PropTypes.func.isRequired,
  onAddParticipantsField: PropTypes.func,
};

ParticipantsFieldSetting.defaultProps = {
  isLocked: false,
  addOptionAble: false,
  title: gettext('Assignee field'),
};

export default ParticipantsFieldSetting;
