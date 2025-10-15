import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { FilterSetter, GroupbySetter, SortSetter, HideColumnSetter, ManageSetter, RowHeightSetter } from '../../data-process-setter';
import Searcher from '../../searcher';
import { VIEW_TOOL, VIEW_TOOLS } from '../../../constants';

const TableViewToolbar = ({
  tools = VIEW_TOOLS,
  readOnly, view, collaborators, fixedColumnCount,
  modifyFilters, modifySorts, modifyGroupbys, modifyRowHeight, modifyHiddenColumns, modifyColumnOrder, searchRows
}) => {
  const viewType = useMemo(() => view.type, [view]);
  const viewColumns = useMemo(() => {
    if (!view) return [];
    return view.columns;
  }, [view]);

  const filterColumns = useMemo(() => {
    return viewColumns;
  }, [viewColumns]);

  return (
    <>
      {tools.includes(VIEW_TOOL.SEARCH) && (
        <Searcher onChange={searchRows} />
      )}
      {tools.includes(VIEW_TOOL.FILTERS) && (
        <FilterSetter
          wrapperClass="sea-metadata-view-tool-filter mr-2"
          filtersClassName="sea-metadata-filters"
          target="sea-metadata-filter-popover"
          readOnly={readOnly}
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
          readOnly={readOnly}
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
          readOnly={readOnly}
          columns={viewColumns}
          groupbys={view.groupbys}
          modifyGroupbys={modifyGroupbys}
        />
      )}
      {tools.includes(VIEW_TOOL.ROW_HEIGHT) && (
        <RowHeightSetter
          wrapperClass="sea-metadata-view-tool-operation-btn"
          target="sea-metadata-row-height-popover"
          readOnly={readOnly}
          rowHeight={view.row_height}
          modifyRowHeight={modifyRowHeight}
        />
      )}
      {tools.includes(VIEW_TOOL.ORDER_HIDDEN) && (
        <HideColumnSetter
          wrapperClass="sea-metadata-view-tool-hide-column mr-2"
          target="sea-metadata-hide-column-popover"
          readOnly={readOnly}
          columns={viewColumns.slice(fixedColumnCount)}
          hiddenColumns={view.hidden_columns || []}
          modifyHiddenColumns={modifyHiddenColumns}
          modifyColumnOrder={modifyColumnOrder}
        />
      )}
      {tools.includes(VIEW_TOOL.MANAGE) && (
        <ManageSetter />
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
