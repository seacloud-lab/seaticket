import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { DragSource, DropTarget } from 'react-dnd';
import { LongTextEditorDialog } from '@seafile/seafile-editor';
import { FILTER_COLUMN_OPTIONS, CellType, getValidFilters, FILTER_PREDICATE_TYPE } from 'dtable-utils';
import FormLabel from '../../../components-form/form-label';
import FormEditorGenerator from '../../../components-form/form-editor-generator';
import { FILTER_PREDICATE_SHOW, FILTER_TERM_MODIFIER_SHOW } from '../../../constants/filter-show-constants';
import { gettext } from '../../../utils/constants';
import LongTextEditorPreviewAll from '../../../components-form/cell-editor-widgets/long-text-editor-preview-all';
import LongTextEditorUtils from '../../../components-form/utils/long-text-editor-utils';
import EditRowItem from './edit-row-item';
import FiltersTooltip from './filters-tooltip';
import DragIconTooltip from './drag-icon-tooltip';
import { isMobile } from '../../../utils/utils';
import { FORM_REMARK_DEFAULT_TEXT_COLOR } from '../../../constants/form-constants';
import { isLongTextValueExceedLimit } from '../../../components-form/utils/utils';
import { toaster } from 'dtable-ui-component';

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
    if (optionSource.idx === -1) {
      props.addItem(optionSource, optionTarget);
    } else if (targetIdx !== optionSource.idx) {
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

const { workspaceID, token, dtableWebURL } = window.shared.pageOptions;

class SettingRowItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowLongTextEditor: false,
      isShowEditTextBtn: false,
      isShowOperationBtn: false,
    };

    this._editorUtils = new LongTextEditorUtils({
      editorType: 'column-description',
      token,
      dtableWebURL,
      workspaceID,
      apiUploadLinkName: 'getUploadLinkViaFormToken'
    });
  }

  onDescriptionMouseEnter = () => {
    this.showEditTextBtn();
  };

  onDescriptionMouseOver = () => {
    this.showEditTextBtn();
  };

  onDescriptionMouseLeave = () => {
    this.setState({ isShowEditTextBtn: false });
  };

  onRowItemMouseEnter = () => {
    this.showOperationBtn();
  };

  onRowItemMouseOver = () => {
    this.showOperationBtn();
  };

  onRowItemMouseLeave = () => {
    this.setState({ isShowOperationBtn: false });
  };

  showOperationBtn = () => {
    const { draggedRow } = this.props;
    if (draggedRow || this.state.isShowOperationBtn) return;
    this.setState({ isShowOperationBtn: true });
  };

  showEditTextBtn = () => {
    const { draggedRow } = this.props;
    if (draggedRow || this.state.isShowEditTextBtn) return;
    this.setState({ isShowEditTextBtn: true });
  };

  toggleLongText = (event) => {
    event && event.stopPropagation();
    this.setState({
      isShowLongTextEditor: !this.state.isShowLongTextEditor,
    });
  };

  updateSettingElement = (e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    const { column } = this.props;
    this.props.updateSettingElement(column);
  };

  getFilteredColumns = () => {
    const { currentColumns } = this.props;
    let filterColumns = [];
    currentColumns.forEach((column) => {
      if (column.editable && column.type !== CellType.LINK && FILTER_COLUMN_OPTIONS[column.type]) {
        filterColumns.push(column);
      }
    });
    return filterColumns;
  };

  getSuccessTooltipDescription = (filters, currentColumns) => {
    let { column } = this.props;
    let baseText = gettext('The field will show when');
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
      <>
        {baseText}
        <span className="filters-success-tooltips-content">{contentText}</span>
      </>
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
            description={gettext('Condition references a field that was removed from the form.')}
            type="warning"
          />
          <span className="filters-warning-description">{gettext('Conditions on this field are invalid')}</span>
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
        <span className="filters-success-description">{gettext('Conditional field')}</span>
      </div>
    );
  };

  onHideColumn = (event) => {
    event.stopPropagation();
    let { column, currentColumns, elementsOrder } = this.props;
    const columnIndex = currentColumns.findIndex(item => item.key === column.key);
    const updateColumn = { ...currentColumns[columnIndex], ...{ editable: false } };
    currentColumns[columnIndex] = updateColumn;
    elementsOrder = elementsOrder.filter(item => item.key !== column.key);
    this.props.onSave({ currentColumns, elementsOrder });
    this.props.updateSettingElement(null);
  };

  onDeleteColumnDescription = (event) => {
    event && event.stopPropagation();
    const { column, onColumnChanged } = this.props;
    onColumnChanged(column.key, { description: '' });
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

  renderDescription = () => {
    const { isShowEditTextBtn, isShowLongTextEditor } = this.state;
    const { column, formColumnDescriptionColor } = this.props;
    const description = column.description;
    const style = { color: formColumnDescriptionColor || FORM_REMARK_DEFAULT_TEXT_COLOR };
    if (!description) return;
    return (
      <div
        className="column-description"
        onMouseEnter={this.onDescriptionMouseEnter}
        onMouseOver={this.onDescriptionMouseOver}
        onMouseLeave={this.onDescriptionMouseLeave}
      >
        <LongTextEditorPreviewAll
          style={style}
          newValue={{ text: description }}
          isShowEditTextBtn={isShowEditTextBtn}
          onEditContentBtnClick={this.toggleLongText}
          onDeleteContentBtnClick={this.onDeleteColumnDescription}
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
    const { isReadOnly, isEditing, column, currentColumns, row, isOver, canDrop, draggedRow, index,
      isDragging, connectDragSource, connectDropTarget, connectDragPreview, onColumnChanged, onColumnRequiredChanged } = this.props;
    const { isShowOperationBtn } = this.state;
    const isCurrentElement = draggedRow && draggedRow.idx === index;
    const filteredColumns = this.getFilteredColumns();
    const validFilters = getValidFilters(column.filters || [], currentColumns); // column be delete from table
    const { enable_fill_default_value: enableFillDefaultValue, default_value: defaultValue,
      enable_not_change_default_value: enableNotChangeDefaultValue } = column;
    if (isEditing && isMobile) {
      return <EditRowItem
        isReadOnly={isReadOnly}
        column={column}
        row={row}
        currentColumns={currentColumns}
        validFilters={validFilters}
        filteredColumns={filteredColumns}
        filters={column.filters || []}
        onColumnChanged={onColumnChanged}
        onColumnRequiredChanged={onColumnRequiredChanged}
        enableReadOnly={this.props.enableReadOnly}
      />;
    }
    return (
      connectDropTarget(
        connectDragPreview(
          <div
            className={classnames('form_mode setting-row-item mt-1 mb-1',
              { 'hover-item': isShowOperationBtn },
              { 'setting-row-item-active': isEditing }
            )}
            onMouseEnter={this.onRowItemMouseEnter}
            onMouseOver={this.onRowItemMouseOver}
            onMouseLeave={this.onRowItemMouseLeave}
            onClick={this.updateSettingElement}
          >
            {isOver && canDrop && isDragging && !isCurrentElement && <div className="drop-placeholder mb-4"></div>}
            {!isMobile && isShowOperationBtn &&
              <>
                <div className="operation-button operation-button-delete" onClick={this.onHideColumn}>
                  <i className="dtable-font dtable-icon-delete"></i>
                </div>
                {connectDragSource(
                  <div className="operation-button operation-button-drag" id="drag-button">
                    <i className="dtable-font dtable-icon-drag"></i>
                    <DragIconTooltip showTooltip={!draggedRow} />
                  </div>
                )}
              </>
            }
            {this.getFiltersTooltip(validFilters, filteredColumns)}
            <div className="cell-label-container">
              <FormLabel column={column} />
            </div>
            {this.renderDescription()}
            <div>
              <FormEditorGenerator
                useInlineEditor={true}
                isReadOnly={isReadOnly}
                isSubmitting={enableFillDefaultValue && enableNotChangeDefaultValue}
                isSupportPreview={false}
                column={column}
                value={enableFillDefaultValue ? defaultValue : undefined}
                row={row}
                columns={currentColumns}
                onCommit={() => {}}
                isEditFormPage={true}
              />
            </div>
            {isOver && canDrop && !isDragging && !isCurrentElement && <div className="drop-placeholder mt-4"></div>}
          </div>
        )
      )
    );
  }
}

SettingRowItem.propTypes = {
  isReadOnly: PropTypes.bool,
  enableReadOnly: PropTypes.bool,
  isEditing: PropTypes.bool,
  isOver: PropTypes.bool,
  canDrop: PropTypes.bool,
  isDragging: PropTypes.bool,
  formColumnDescriptionColor: PropTypes.string,
  index: PropTypes.number,
  draggedRow: PropTypes.object,
  column: PropTypes.object,
  row: PropTypes.object,
  currentColumns: PropTypes.array,
  elementsOrder: PropTypes.array,
  onColumnChanged: PropTypes.func,
  updateSettingElement: PropTypes.func,
  onSave: PropTypes.func,
  moveItem: PropTypes.func,
  addItem: PropTypes.func,
  connectDragSource: PropTypes.func,
  connectDropTarget: PropTypes.func,
  connectDragPreview: PropTypes.func,
  onColumnRequiredChanged: PropTypes.func,
};

export default DropTarget('DtableFormElements', dropTarget, dropCollect)(
  DragSource('DtableFormElements', dragSource, dragCollect)(SettingRowItem)
);
