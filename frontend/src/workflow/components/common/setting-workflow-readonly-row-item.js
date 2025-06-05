import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { DragSource, DropTarget } from 'react-dnd';
import { FILTER_COLUMN_OPTIONS, CellType, getValidFilters, FILTER_PREDICATE_TYPE } from 'dtable-utils';
import CellLabel from '../../../components-form/cell-label';
import WorkflowEditorGenerator from '../cell-editor';
import { FILTER_PREDICATE_SHOW, FILTER_TERM_MODIFIER_SHOW } from '../../../constants/filter-show-constants';
import LongTextEditorPreviewAll from '../../../components-form/cell-editor-widgets/long-text-editor-preview-all';
import FiltersTooltip from '../../../pages/dtable-edit-form/widgets/filters-tooltip';
import DragIconTooltip from '../../../pages/dtable-edit-form/widgets/drag-icon-tooltip';

const gettext = window.gettext;

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

class SettingWorkflowReadOnlyRowItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowOperationBtn: false,
    };
  }

  onMouseEnter = () => {
    const { draggedRow } = this.props;
    if (draggedRow) return;
    this.setState({ isShowOperationBtn: true });
  };

  onMouseLeave = () => {
    this.setState({ isShowOperationBtn: false });
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
      } else if (type === CellType.SINGLE_SELECT && Array.isArray(filterTerm)){
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
      <Fragment>
        {baseText}
        <span className="filters-success-tooltips-content">{contentText}</span>
      </Fragment>
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

  renderDescription = () => {
    const description = this.props.column.description;
    if (!description) return null;
    return (
      <div>
        <LongTextEditorPreviewAll
          newValue={{ text: description }}
        />
      </div>
    );
  };

  renderField = () => {
    const { column, editorConfig, currentColumns } = this.props;
    const { enable_fill_default_value: enableFillDefaultValue, default_value: defaultValue,
      enable_not_change_default_value: enableNotChangeDefaultValue } = column;
    if (column.type === CellType.FORMULA) {
      return <div className="form-control text-truncate readOnly"></div>;
    }
    return (
      <WorkflowEditorGenerator
        isReadOnly={true}
        isSubmitting={enableFillDefaultValue && enableNotChangeDefaultValue}
        column={column}
        value={enableFillDefaultValue ? defaultValue : undefined}
        row={{}}
        editorConfig={editorConfig}
        columns={currentColumns}
        onCommit={() => {}}
      />
    );
  };

  render() {
    const { column, currentColumns, connectDragSource, connectDropTarget, connectDragPreview,
      isDragging, isOver, canDrop, index, draggedRow } = this.props;
    const { isShowOperationBtn } = this.state;
    const isCurrentElement = draggedRow && draggedRow.idx === index;
    const filteredColumns = this.getFilteredColumns();
    const validFilters = getValidFilters(column.filters || [], currentColumns); // column be delete from table
    return (
      connectDropTarget(
        connectDragPreview(
          <div
            className={classnames('form_mode compose-editor setting-row-item',
              { 'read-only-hover-item': isShowOperationBtn },
            )}
            onMouseEnter={this.onMouseEnter}
            onMouseLeave={this.onMouseLeave}
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
              {this.renderField()}
            </div>
            {isOver && canDrop && !isDragging && !isCurrentElement && <div className="drop-placeholder mt-4"></div>}
          </div>
        )
      )
    );
  }
}

SettingWorkflowReadOnlyRowItem.propTypes = {
  isOver: PropTypes.bool,
  canDrop: PropTypes.bool,
  isDragging: PropTypes.bool,
  index: PropTypes.number,
  currentColumns: PropTypes.array,
  column: PropTypes.object,
  draggedRow: PropTypes.object,
  editorConfig: PropTypes.object,
  moveItem: PropTypes.func,
  connectDragSource: PropTypes.func,
  connectDropTarget: PropTypes.func,
  connectDragPreview: PropTypes.func,
};

export default DropTarget('WorkflowReadOnlyFields', dropTarget, dropCollect)(
  DragSource('WorkflowReadOnlyFields', dragSource, dragCollect)(SettingWorkflowReadOnlyRowItem)
);
