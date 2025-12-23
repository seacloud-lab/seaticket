import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { FilterSetter, GroupbySetter, SortSetter, HideColumnSetter, ManageSetter, RowHeightSetter } from '../../data-process-setter';
import Searcher from '../../searcher';
import { VIEW_TOOL, VIEW_TOOLS } from '../../../constants';

const TableViewToolbar = ({
  tools = VIEW_TOOLS,
  readOnly, view, collaborators, fixedColumnCount,
  modifyFilters, modifySorts, modifyGroupbys, modifyRowHeight, modifyHiddenColumns, modifyColumnOrder, modifyViewLock, searchRows
}) => {
  const viewType = useMemo(() => view.type, [view]);
  const viewId = useMemo(() => view._id, [view._id]);
  const viewColumns = useMemo(() => {
    if (!view) return [];
    return view.columns;
  }, [view]);

  const filterColumns = useMemo(() => {
    return viewColumns;
  }, [viewColumns]);

  // If the view is locked, disable filtering, sorting, grouping, and other operations
  const isViewLocked = view.is_locked;
  const isReadOnly = readOnly || isViewLocked;

  return (
    <>
      {tools.includes(VIEW_TOOL.SEARCH) && (
        <Searcher viewId={viewId} onChange={searchRows} />
      )}
      {tools.includes(VIEW_TOOL.FILTERS) && (
        <FilterSetter
          wrapperClass="sea-metadata-view-tool-filter mr-2"
          filtersClassName="sea-metadata-filters"
          target="sea-metadata-filter-popover"
          readOnly={isReadOnly}
          filterConjunction={view.filter_conjunction}
          basicFilters={view.basic_filters}
          filters={view.filters}
          columns={filterColumns}
          modifyFilters={modifyFilters}
          collaborators={collaborators}
          viewType={viewType}
        />
      )}
      {tools.includes(VIEW_TOOL.SORTS) && (
        <SortSetter
          wrapperClass="sea-metadata-view-tool-sort mr-2"
          target="sea-metadata-sort-popover"
          readOnly={isReadOnly}
          sorts={view.sorts}
          type={viewType}
          columns={viewColumns}
          modifySorts={modifySorts}
        />
      )}
      {tools.includes(VIEW_TOOL.GROUPBYS) && (
        <GroupbySetter
          wrapperClass="sea-metadata-view-tool-groupby mr-2"
          target="sea-metadata-groupby-popover"
          readOnly={isReadOnly}
          columns={viewColumns}
          groupbys={view.groupbys}
          modifyGroupbys={modifyGroupbys}
        />
      )}
      {tools.includes(VIEW_TOOL.ROW_HEIGHT) && (
        <RowHeightSetter
          wrapperClass="sea-metadata-view-tool-row-height mr-2"
          target="sea-metadata-row-height-popover"
          readOnly={isReadOnly}
          rowHeight={view.row_height}
          modifyRowHeight={modifyRowHeight}
        />
      )}
      {tools.includes(VIEW_TOOL.ORDER_HIDDEN) && (
        <HideColumnSetter
          wrapperClass="sea-metadata-view-tool-hide-column mr-2"
          target="sea-metadata-hide-column-popover"
          readOnly={isReadOnly}
          columns={viewColumns.slice(fixedColumnCount)}
          hiddenColumns={view.hidden_columns || []}
          modifyHiddenColumns={modifyHiddenColumns}
          modifyColumnOrder={modifyColumnOrder}
        />
      )}
      {tools.includes(VIEW_TOOL.MANAGE) && (
        <ManageSetter
          readOnly={readOnly}
          modifyViewLock={modifyViewLock}
        />
      )}
    </>
  );
};

TableViewToolbar.propTypes = {
  readOnly: PropTypes.bool,
  view: PropTypes.object.isRequired,
  collaborators: PropTypes.array,
  modifyFilters: PropTypes.func,
  modifySorts: PropTypes.func,
  modifyGroupbys: PropTypes.func,
  modifyRowHeight: PropTypes.func,
  modifyHiddenColumns: PropTypes.func,
  modifyColumnOrder: PropTypes.func,
};

export default TableViewToolbar;
