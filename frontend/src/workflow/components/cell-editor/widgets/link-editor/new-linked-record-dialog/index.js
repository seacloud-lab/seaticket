import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Row, Col } from 'reactstrap';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import { COLUMNS_ICON_CONFIG } from 'dtable-utils';
import { ROW_EXPAND_DIALOG_MODAL } from '../../../../../../components-form/utils/zIndexes';
import { LINKED_TABLE_SUPPORT_EDIT_TYPE_MAP } from '../../../../../../constants/form-constants';
import { getMissedRequiredColumns } from '../../../../../utils/utils';
import WorkflowEditorGenerator from '../../../../cell-editor/index';
import { Utils } from '../../../../../../utils/utils';
import CommonOperationConfirmationDialog from '../../../../../../components/dialog/common-operation-confirmation-dialog';
import { getLinkFieldsSettings } from '../../../../../../workflow/utils/utils';

import './index.css';

const gettext = window.gettext;

class NewLinkedRecordDialog extends Component {

  constructor(props) {
    super(props);
    this.state = {
      record: props.activeLinkedRow || {},
      hasCommitedChanges: false,
      isShowConfirmCloseDialog: false,
    };
    this.columns = this.getDisplayColumns();
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount() {
    this.props.clearActiveLinkedRecord();
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onKeyDown = (e) => {
    if (e.keyCode === Utils.keyCodes.esc) {
      this.props.onToggle();
    }
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

  toggle = () => {
    if (this.state.hasCommitedChanges) {
      this.setState({ isShowConfirmCloseDialog: true });
      return;
    }
    this.props.onToggle();
  };

  onCommit = (update) => {
    this.setState({ record: { ...this.state.record, ...update }, hasCommitedChanges: true });
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

  insertRecord = () => {
    const { record } = this.state;
    const hasMissedRequiredCells = this.checkHasMissedRequiredCells();
    if (hasMissedRequiredCells) return;
    this.props.insertNewLinkedRow(record);
  };

  updateRecord = () => {
    const { record } = this.state;
    const hasMissedRequiredCells = this.checkHasMissedRequiredCells();
    if (hasMissedRequiredCells) return;
    this.props.updateLinkedRow(record);
  };

  confirmCloseToggle = () => {
    this.setState({ isShowConfirmCloseDialog: !this.state.isShowConfirmCloseDialog });
  };

  renderColumn = (displayColumn) => {
    if (!displayColumn) return null;
    const { type, name, key } = displayColumn;
    const { table, tables, column, editorConfig, isReadOnly, collaborators, canViewFile } = this.props;
    const { linkRequiredFields } = getLinkFieldsSettings(column);
    const isRequired = linkRequiredFields.includes(displayColumn.key);
    const value = this.state.record[displayColumn.key] || null;
    return (
      <Row className="linked-record-column-item d-flex" key={`linked-record-column-${key}`}>
        <Col md={3} className="linked-record-column-title">
          <i className={`${COLUMNS_ICON_CONFIG[type]} mr-2`}></i>
          <span className="linked-record-column-name">{name || ''}</span>
          {isRequired && <span className="cell-is-required">*</span>}
        </Col>
        <Col md={9} className="linked-record-column-editor-content">
          <WorkflowEditorGenerator
            isReadOnly={isReadOnly}
            value={value}
            row={this.state.record}
            column={displayColumn}
            columns={this.columns}
            tables={tables}
            table={table}
            editorConfig={editorConfig}
            onCommit={this.onCommit}
            collaborators={collaborators}
            canViewFile={canViewFile}
          />
        </Col>
      </Row>
    );
  };

  render() {
    const { isShowConfirmCloseDialog } = this.state;
    const { activeLinkedRow, isReadOnly } = this.props;
    const isEditMode = activeLinkedRow ? true : false;
    const modalClass = 'workflow-task-link-dialog';
    const title = isEditMode ? gettext('Linked record') : gettext('Add record');
    const isEmpty = this.columns.length === 0 ? true : false;

    return (
      <Modal isOpen={true} autoFocus={false} className={modalClass} zIndex={ROW_EXPAND_DIALOG_MODAL} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{title}</DTableModalHeader>
        <ModalBody className={`new-linked-record-dialog-body ${isEmpty ? 'pt-4' : ''}`}>
          <div className="new-linked-record-columns-content">
            {isEmpty && <span>{gettext('There are currently no fields to display, please configure the visible fields.')}</span>}
            {!isEmpty && this.columns.map(column => {
              return (
                <Fragment key={column.key}>{this.renderColumn(column)}</Fragment>
              );
            })}
          </div>
        </ModalBody>
        {!isReadOnly &&
          <ModalFooter>
            <Button color="secondary" onClick={this.props.onToggle}>{gettext('Cancel')}</Button>
            {isEditMode ?
              <Button color="primary" onClick={this.updateRecord} disabled={isReadOnly}>{gettext('Update')}</Button>
              :
              <Button color="primary" onClick={this.insertRecord}>{gettext('Submit')}</Button>
            }
          </ModalFooter>
        }
        {isShowConfirmCloseDialog &&
          <CommonOperationConfirmationDialog
            title={`${gettext('Close')} ${title}`}
            message={gettext('There are uncommitted changes, do you still want to close it?')}
            executeOperation={this.props.onToggle}
            toggleDialog={this.confirmCloseToggle}
          />
        }
      </Modal>
    );
  }
}

NewLinkedRecordDialog.propTypes = {
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
  canViewFile: PropTypes.bool,
};

export default NewLinkedRecordDialog;
