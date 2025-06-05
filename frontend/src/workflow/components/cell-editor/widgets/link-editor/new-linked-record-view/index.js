import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import MobileCommonHeader from '../../../../../../pages/dtable/mobile/mobile-common-header';
import { LINKED_TABLE_SUPPORT_EDIT_TYPE_MAP } from '../../../../../../constants/form-constants';
import { getMissedRequiredColumns } from '../../../../../utils/utils';
import WorkflowRowItem from '../../../../common/workflow-row-item';
import { getLinkFieldsSettings } from '../../../../../../workflow/utils/utils';

const gettext = window.gettext;

class NewLinkedRecordView extends Component {

  constructor(props) {
    super(props);
    this.state = {
      record: props.activeLinkedRow || {},
    };
    this.columns = this.getDisplayColumns();
  }

  componentDidMount() {
    history.pushState(null, null, '#');
    window.addEventListener('popstate', this.handleHistoryBack, false);
  }

  componentWillUnmount() {
    this.props.clearActiveLinkedRecord();
    window.removeEventListener('popstate', this.handleHistoryBack, false);
  }

  handleHistoryBack = (e) => {
    e.preventDefault();
    this.props.onToggle();
  };

  getDisplayColumns = () => {
    const { columns, column, activeLinkedRow } = this.props;
    const isEditMode = activeLinkedRow ? true : false;
    const { linkVisibleFields } = getLinkFieldsSettings(column);
    let displayColumns = [];
    if (isEditMode) {
      displayColumns = columns.filter(item => linkVisibleFields.includes(item.key));
    } else {
      displayColumns = columns.filter(item => LINKED_TABLE_SUPPORT_EDIT_TYPE_MAP[item.type] && linkVisibleFields.includes(item.key));
    }
    return displayColumns;
  };

  getRequiredColumns = () => {
    const { column } = this.props;
    const { linkRequiredFields } = getLinkFieldsSettings(column);
    let requiredColumns = this.columns.filter(column => {
      return linkRequiredFields.includes(column.key);
    }).slice(0);
    requiredColumns.forEach(column => {
      column.is_required = true;
    });
    return requiredColumns;
  };

  onUpdateRecord = (update) => {
    this.setState({ record: { ...this.state.record, ...update } });
  };

  checkHasMissedRequiredCells = () => {
    const { record } = this.state;
    const requiredColumns = this.getRequiredColumns();
    const missedRequiredCells = getMissedRequiredColumns(requiredColumns, record);
    const missedRequiredCellsLen = missedRequiredCells.length;
    if (missedRequiredCellsLen > 0) {
      let message = missedRequiredCellsLen > 1 ? gettext('Some required fields are missing') : gettext('A required field is missing');
      toaster.danger(message);
      return true;
    }
    return false;
  };

  onCommit = () => {
    const hasMissedRequiredCells = this.checkHasMissedRequiredCells();
    if (hasMissedRequiredCells) return;
    const { activeLinkedRow } = this.props;
    const { record } = this.state;
    const isEditMode = activeLinkedRow ? true : false;
    if (isEditMode) {
      this.props.updateLinkedRow(record);
    } else {
      this.props.insertNewLinkedRow(record);
    }
    this.props.onToggle();
  };

  renderColumns = () => {
    const { record } = this.state;
    const { table, tables, editorConfig, isReadOnly, activeLinkedRow, collaborators } = this.props;
    const isEditMode = activeLinkedRow ? true : false;
    return (
      <div className="add-workflow-task-columns-content">
        {this.columns.map(column => {
          const value = record[column.key] || null;
          return (
            <WorkflowRowItem
              isReadOnly={isReadOnly}
              key={column.key}
              column={column}
              columns={this.columns}
              row={record}
              tables={tables}
              table={table}
              value={value}
              editorConfig={editorConfig}
              onCommit={this.onUpdateRecord}
              collaborators={collaborators}
            />
          );
        })}
        {!isEditMode &&
          <Button
            className="submit-workflow mb-4 mt-4 flex-shrink-0 d-flex justify-content-center align-items-center"
            onClick={this.onCommit}
            disabled={isReadOnly}
            color='primary'
          >
            {gettext('Submit')}
          </Button>
        }
      </div>
    );
  };

  render() {
    const { activeLinkedRow } = this.props;
    const isEditMode = activeLinkedRow ? true : false;
    return (
      <div className="add-workflow-task-view workflow-list-view">
        <MobileCommonHeader
          leftName={(<i className="dtable-font dtable-icon-return"></i>)}
          onLeftClick={this.props.onToggle}
          title={(
            <>
              <span className="align-items-center justify-content-center">
                {isEditMode ? gettext('Linked record') : gettext('Add record')}
              </span>
            </>
          )}
        />
        <div className="add-workflow-task-view-container">
          {this.columns.length === 0 && <span>{gettext('There are currently no fields to display, please configure the visible fields.')}</span>}
          {this.renderColumns()}
        </div>
      </div>
    );
  }
}

NewLinkedRecordView.propTypes = {
  isReadOnly: PropTypes.bool,
  tables: PropTypes.array,
  columns: PropTypes.array,
  collaborators: PropTypes.array,
  editorConfig: PropTypes.object,
  activeLinkedRow: PropTypes.object,
  table: PropTypes.object,
  column: PropTypes.object,
  onToggle: PropTypes.func,
  insertNewLinkedRow: PropTypes.func,
  updateLinkedRow: PropTypes.func,
  clearActiveLinkedRecord: PropTypes.func,
};

export default NewLinkedRecordView;
