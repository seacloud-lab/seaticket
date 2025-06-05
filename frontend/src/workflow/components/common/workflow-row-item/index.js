import React from 'react';
import PropTypes from 'prop-types';
import { Col } from 'reactstrap';
import CellLabel from '../../../../components-form/cell-label';
import WorkflowEditorGenerator from '../../cell-editor';
import LongTextEditorPreviewAll from '../../../../components-form/cell-editor-widgets/long-text-editor-preview-all';
import { COLUMN_CONFIG_KEY } from '../../../constants';
import { Utils } from '../../../../utils/utils';

import '../../../css/workflow-row-item.css';

const isDesktop = Utils.isDesktop();

class WorkflowRowItem extends React.Component {

  static defaultProps = {
    isFormMode: false,
    isReadOnly: false,
    isShowDescriptionDirectly: true,
    canViewFile: false,
    collaborators: [],
  };

  onCommit = (updated) => {
    this.props.onCommit && this.props.onCommit(updated);
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isEditorShow) {
      this.props.setScrollTop && this.props.setScrollTop(this.workflowRowItem.offsetTop);
    }
  }

  setRowRef = (rowItem) => {
    this.workflowRowItem = rowItem;
  };

  render() {
    const { isReadOnly, isSupportPreview, isFormMode, column, value, isEditorShow, isSubmitting, row, columns, editorConfig,
      canViewFile, tables, table, collaborators, isShowDescriptionDirectly, workflowTaskId } = this.props;
    const description = column[COLUMN_CONFIG_KEY.DESCRIPTION];
    const descriptionStyle = { color: '#666666', fontSize: '13px', backgroundColor: '#f9f9f9' };
    const mode = !isFormMode && isDesktop ? 'row_expand' : 'form';
    return (
      <div
        ref={(rowItem) => {this.setRowRef(rowItem);}}
        className={`workflow-form-mode form_mode compose-editor ${mode === 'row_expand' ? 'row-expand-style' : ''}`}
      >
        <Col md={3} className={`${mode === 'row_expand' ? '' : 'p-0'}`}>
          <div className="cell-label-container">
            <CellLabel column={column} isShowHelpIcon={!isShowDescriptionDirectly && Boolean(description)}></CellLabel>
          </div>
        </Col>
        {isShowDescriptionDirectly && description && <LongTextEditorPreviewAll newValue={{ text: description }} style={descriptionStyle}/>}
        <Col md={9} className={`${mode === 'row_expand' ? '' : 'p-0'} d-flex align-items-center`}>
          <WorkflowEditorGenerator
            isReadOnly={isReadOnly}
            isSupportPreview={isSupportPreview}
            isSubmitting={isSubmitting}
            value={value}
            mode={mode}
            column={column}
            isEditorShow={isEditorShow}
            row={row}
            columns={columns}
            tables={tables}
            table={table}
            editorConfig={editorConfig}
            onCommit={this.onCommit}
            updateTabIndex={this.props.updateTabIndex}
            getHistoryCommitByColumnKey={this.props.getHistoryCommitByColumnKey}
            canViewFile={canViewFile}
            collaborators={collaborators}
            queryUsers={this.props.queryUsers}
            workflowTaskId={workflowTaskId}
          />
        </Col>
      </div>
    );
  }
}

WorkflowRowItem.propTypes = {
  isFormMode: PropTypes.bool,
  isReadOnly: PropTypes.bool,
  isSupportPreview: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isShowDescriptionDirectly: PropTypes.bool,
  canViewFile: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  workflowTaskId: PropTypes.number,
  column: PropTypes.object.isRequired,
  firstEditorKeyPress: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array, PropTypes.object, PropTypes.bool, PropTypes.number]),
  row: PropTypes.object,
  columns: PropTypes.array,
  tables: PropTypes.array,
  table: PropTypes.object,
  editorConfig: PropTypes.object.isRequired,
  onCommit: PropTypes.func,
  setScrollTop: PropTypes.func,
  updateTabIndex: PropTypes.func,
  getHistoryCommitByColumnKey: PropTypes.func,
  collaborators: PropTypes.array,
  queryUsers: PropTypes.func,
};

export default WorkflowRowItem;
