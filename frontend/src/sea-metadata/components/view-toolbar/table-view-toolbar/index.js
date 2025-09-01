import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { FilterSetter, GroupbySetter, SortSetter, HideColumnSetter, ManageSetter } from '../../data-process-setter';
import Searcher from '../../searcher';
import { VIEW_TOOLS } from '../../../constants';

const TableViewToolbar = ({
  tools = VIEW_TOOLS,
  readOnly, view, collaborators,
  modifyFilters, modifySorts, modifyGroupbys, modifyHiddenColumns, modifyColumnOrder, searchRows
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
      {tools.includes('search') && (
        <Searcher onChange={searchRows} />
      )}
      {tools.includes('filters') && (
        <FilterSetter
          wrapperClass="sea-metadata-view-tool-operation-btn sea-metadata-view-tool-filter"
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
      {tools.includes('sorts') && (
        <SortSetter
          wrapperClass="sea-metadata-view-tool-operation-btn sea-metadata-view-tool-sort"
          target="sea-metadata-sort-popover"
          readOnly={readOnly}
          sorts={view.sorts}
          type={viewType}
          columns={viewColumns}
          modifySorts={modifySorts}
        />
      )}
      {tools.includes('groupbys') && (
        <GroupbySetter
          wrapperClass="sea-metadata-view-tool-operation-btn sea-metadata-view-tool-groupby"
          target="sea-metadata-groupby-popover"
          readOnly={readOnly}
          columns={viewColumns}
          groupbys={view.groupbys}
          modifyGroupbys={modifyGroupbys}
        />
      )}
      {tools.includes('order_and_hidden') && (
        <HideColumnSetter
          wrapperClass="sea-metadata-view-tool-operation-btn sea-metadata-view-tool-hide-column"
          target="sea-metadata-hide-column-popover"
          readOnly={readOnly}
          columns={viewColumns.slice(1)}
          hiddenColumns={view.hidden_columns || []}
          modifyHiddenColumns={modifyHiddenColumns}
          modifyColumnOrder={modifyColumnOrder}
        />
      )}
      <ManageSetter />
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
  modifyHiddenColumns: PropTypes.func,
  modifyColumnOrder: PropTypes.func,
};

export default TableViewToolbar;
