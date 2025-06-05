import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { toaster } from 'dtable-ui-component';
import { DragSource, DropTarget } from 'react-dnd';
import { LongTextEditorDialog } from '@seafile/seafile-editor';
import { FILTER_COLUMN_OPTIONS, CellType, getValidFilters, FILTER_PREDICATE_TYPE } from 'dtable-utils';
import CellLabel from '../../../components-form/cell-label';
import WorkflowEditorGenerator from '../cell-editor';
import { FILTER_PREDICATE_SHOW, FILTER_TERM_MODIFIER_SHOW } from '../../../constants/filter-show-constants';
import LongTextEditorPreviewAll from '../../../components-form/cell-editor-widgets/long-text-editor-preview-all';
import LongTextEditorUtils from '../../../components-form/utils/long-text-editor-utils';
import FiltersTooltip from '../../../pages/dtable-edit-form/widgets/filters-tooltip';
import DragIconTooltip from '../../../pages/dtable-edit-form/widgets/drag-icon-tooltip';
import { isLongTextValueExceedLimit } from '../../../components-form/utils/utils';

const gettext = window.gettext;

const { workspaceID, token, dtableWebURL } = window.shared.pageOptions;

const dragSource = {
  beginDrag: props => {
    return { idx: props.index };
  },

  endDrag(props, monitor) {
    const optionSource = monitor.getItem();
    const didDrop = monitor.didDrop();
    let optionTarget = {};
    if (!didDrop) {
      return { optionSource, optionTarget };
    }
  },

  isDragging(props) {
    const { index, draggedRow } = props;
    const { idx } = draggedRow;
    return idx > index;
  }
};

const dropTarget = {
  drop(props, monitor) {
    const optionSource = monitor.getItem();
    const { index: targetIdx } = props;
    let optionTarget = { idx: targetIdx };
    if (targetIdx !== optionSource.idx) {
      props.moveItem(optionSource, optionTarget);
    }
  }
};

const dragCollect = (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  connectDragPreview: connect.dragPreview(),
  isDragging: monitor.isDragging(),
});

const dropCollect = (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop(),
  draggedRow: monitor.getItem()
});

class SettingWorkflowRowItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowLongTextEditor: false,
      isShowEditTextBtn: false,
      isShowOperationBtn: false,
    };
  }

  _editorUtils = new LongTextEditorUtils({
    editorType: 'column-description',
    token,
    dtableWebURL,
    workspaceID,
    apiUploadLinkName: 'getUploadLinkViaWorkflowToken'
  });

  onMouseEnter = () => {
    this.setState({ isShowEditTextBtn: true });
  };

  onMouseLeave = () => {
    this.setState({ isShowEditTextBtn: false });
  };

  onDescriptionMouseEnter = () => {
    const { draggedRow } = this.props;
    if (draggedRow) return;
    this.setState({ isShowEditTextBtn: true });
  };

  onDescriptionMouseLeave = () => {
    this.setState({ isShowEditTextBtn: false });
  };

  onRowItemMouseEnter = () => {
    const { draggedRow } = this.props;
    if (draggedRow) return;
    this.setState({ isShowOperationBtn: true });
  };

  onRowItemMouseLeave = () => {
    this.setState({ isShowOperationBtn: false });
  };

  openEditor = (e) => {
    e.stopPropagation();
    this.props.setEditingColumnIdx();
  };

  getFilteredColumns = () => {
    const { currentColumns } = this.props;
    let filterColumns = [];
    currentColumns.forEach(column => {
      if (column.type !== CellType.LINK && FILTER_COLUMN_OPTIONS[column.type]) {
        filterColumns.push(column);
      }
    });
    return filterColumns;
  };

  getSuccessTooltipDescription = (filters, currentColumns) => {
    let { column } = this.props;
    let baseText = gettext('The column will show when');
    let contentText = '';
    let { filter_conjunction: filterConjunction } = column;
    filterConjunction = filterConjunction || 'And';
    filters.forEach((filter, index) => {
      let { column_key, filter_predicate: filterPredicate, filter_term: filterTerm, filter_term_modifier: filterTermModifier } = filter;
      let filterColumn = currentColumns.find(column => column.key === column_key);
      let { name, type, data } = filterColumn;
      contentText += ` ${name} ${FILTER_PREDICATE_SHOW[filterPredicate]}`;
      if (type === CellType.DATE) {
        contentText += ` ${FILTER_TERM_MODIFIER_SHOW[filterTermModifier]}`;
      }
      if (type === CellType.MULTIPLE_SELECT && Array.isArray(filterTerm)) {
        let options = data && data.options ? data.options : [];
        filterTerm = filterTerm.map(term => {
          let option = options.find(item => item.id === term);
          return option ? option.name : '';
        }).join(', ');
      } else if (type === CellType.SINGLE_SELECT){
        let options = data && data.options ? data.options : [];
        if ([FILTER_PREDICATE_TYPE.IS_ANY_OF, FILTER_PREDICATE_TYPE.IS_NONE_OF].includes(filterPredicate)) {
          filterTerm = filterTerm.map(term => {
            let option = options.find(item => item.id === term);
            return option ? option.name : '';
          }).join(', ');
        } else {
          let option = options.find(item => item.id === filterTerm);
          filterTerm = option ? option.name : '';
        }
      }
      contentText += ` ${filterTerm || ''}`;
      if (index < filters.length - 1) {
        contentText += ` ${filterConjunction === 'And' ? gettext('and') : gettext('or')}`;
      }
    });
    contentText += '.';
    return (
      <>{baseText}<span className="filters-success-tooltips-content">{contentText}</span></>
    );
  };

  getFiltersTooltip = (filters, filteredColumns) => {
    let { column } = this.props;
    let filtersLength = filters.length;
    if (filtersLength === 0) return null;
    let hasInvalidFilters = filters.some(filter => filteredColumns.findIndex(filterColumn => filterColumn.key === filter.column_key) < 0);
    if (hasInvalidFilters) {
      return (
        <div className="filters-warning-tooltips">
          <FiltersTooltip
            id={`filters-tip-warning-${column.key}`}
            description={gettext('Condition references a column that was removed from the form.')}
            type="warning"
          />
          <span className="filters-warning-description">{gettext('Conditions on this column are invalid')}</span>
        </div>
      );
    }
    return (
      <div className="filters-success-tooltips">
        <FiltersTooltip
          id={`filters-tip-success-${column.key}`}
          description={this.getSuccessTooltipDescription(filters, filteredColumns)}
          type="success"
        />
        <span className="filters-success-description">{gettext('Conditional column')}</span>
      </div>
    );
  };

  toggleLongText = (event) => {
    event && event.stopPropagation();
    this.setState({
      isShowLongTextEditor: !this.state.isShowLongTextEditor,
    });
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

  onChangeDescription = (value) => {
    if (!this.isLongTextValueValid(value)) return;
    const { column } = this.props;
    const { text } = value || {};
    const description = (typeof text === 'string' && text.trim()) || '';
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
      this.onChangeDescription(value);
      this.setState({ isShowLongTextEditor: false });
      return;
    }
    // value is invalid
    // nothing todo
  };

  onDeleteDescription = () => {
    const { column } = this.props;
    this.props.onColumnChanged(column.key, { description: '' });
  };

  renderDescription = () => {
    const description = this.props.column.description;
    const { isShowLongTextEditor, isShowEditTextBtn } = this.state;
    if (!description) return null;
    return (
      <div onMouseEnter={this.onDescriptionMouseEnter} onMouseLeave={this.onDescriptionMouseLeave}>
        <LongTextEditorPreviewAll
          newValue={{ text: description }}
          onEditContentBtnClick={this.toggleLongText}
          onDeleteContentBtnClick={this.onDeleteDescription}
          isShowEditTextBtn={isShowEditTextBtn}
        />
        {isShowLongTextEditor && (
          <LongTextEditorDialog
            headerName={gettext('Help text')}
            value={description}
            editorApi={this._editorUtils}
            autoSave={true}
            saveDelay={10 * 1000}
            onSaveEditorValue={this.onChangeDescription}
            onCloseEditorDialog={this.onCloseEditorDialog}
          />
        )}
      </div>
    );
  };

  render() {
    const { isEditing, column, currentColumns, editorConfig, connectDragSource, connectDropTarget,
      connectDragPreview, isDragging, isOver, canDrop, draggedRow, index } = this.props;
    const { isShowOperationBtn } = this.state;
    const isCurrentElement = draggedRow && draggedRow.idx === index;
    const filteredColumns = this.getFilteredColumns();
    const validFilters = getValidFilters(column.filters || [], currentColumns); // column be delete from table
    const { enable_fill_default_value: enableFillDefaultValue, default_value: defaultValue,
      enable_not_change_default_value: enableNotChangeDefaultValue } = column;
    return (
      connectDropTarget(
        connectDragPreview(
          <div
            className={classnames('form_mode compose-editor setting-row-item',
              { 'setting-row-active': isEditing },
              { 'hover-item': isShowOperationBtn }
            )}
            onClick={this.openEditor}
            onMouseEnter={this.onRowItemMouseEnter}
            onMouseLeave={this.onRowItemMouseLeave}
          >
            {isOver && canDrop && isDragging && !isCurrentElement && <div className="drop-placeholder mb-4"></div>}
            {isShowOperationBtn && connectDragSource(
              <div className="operation-button operation-button-drag" id="drag-button">
                <i className="dtable-font dtable-icon-drag"></i>
                <DragIconTooltip showTooltip={!draggedRow} />
              </div>
            )}
            {this.getFiltersTooltip(validFilters, filteredColumns)}
            <div className="cell-label-container">
              <CellLabel column={column}></CellLabel>
            </div>
            {this.renderDescription()}
            <div className="d-flex">
              <WorkflowEditorGenerator
                isReadOnly={true}
                isSupportPreview={false}
                isSubmitting={enableFillDefaultValue && enableNotChangeDefaultValue}
                column={column}
                value={enableFillDefaultValue ? defaultValue : undefined}
                row={{}}
                editorConfig={editorConfig}
                columns={currentColumns}
                onCommit={() => {}}
              />
            </div>
            {isOver && canDrop && !isDragging && !isCurrentElement && <div className="drop-placeholder mt-4"></div>}
          </div>
        )
      )
    );
  }
}

SettingWorkflowRowItem.propTypes = {
  isOver: PropTypes.bool,
  canDrop: PropTypes.bool,
  isDragging: PropTypes.bool,
  draggedRow: PropTypes.object,
  isEditing: PropTypes.bool,
  index: PropTypes.number,
  column: PropTypes.object,
  currentColumns: PropTypes.array,
  editorConfig: PropTypes.object,
  moveItem: PropTypes.func,
  onColumnChanged: PropTypes.func,
  setEditingColumnIdx: PropTypes.func,
  connectDragSource: PropTypes.func,
  connectDropTarget: PropTypes.func,
  connectDragPreview: PropTypes.func,
};

export default DropTarget('WorkflowReadWriteFields', dropTarget, dropCollect)(
  DragSource('WorkflowReadWriteFields', dragSource, dragCollect)(SettingWorkflowRowItem)
);
