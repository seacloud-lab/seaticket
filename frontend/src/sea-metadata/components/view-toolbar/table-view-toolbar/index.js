import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { FilterSetter, GroupbySetter, SortSetter, HideColumnSetter } from '../../data-process-setter';
import Searcher from '../../searcher';

const TableViewToolbar = ({
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
      <Searcher onChange={searchRows} />
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
      <SortSetter
        wrapperClass="sea-metadata-view-tool-operation-btn sea-metadata-view-tool-sort"
        target="sea-metadata-sort-popover"
        readOnly={readOnly}
        sorts={view.sorts}
        type={viewType}
        columns={viewColumns}
        modifySorts={modifySorts}
      />
      <GroupbySetter
        wrapperClass="sea-metadata-view-tool-operation-btn sea-metadata-view-tool-groupby"
        target="sea-metadata-groupby-popover"
        readOnly={readOnly}
        columns={viewColumns}
        groupbys={view.groupbys}
        modifyGroupbys={modifyGroupbys}
      />
      <HideColumnSetter
        wrapperClass="sea-metadata-view-tool-operation-btn sea-metadata-view-tool-hide-column"
        target="sea-metadata-hide-column-popover"
        readOnly={readOnly}
        columns={viewColumns.slice(1)}
        hiddenColumns={view.hidden_columns || []}
        modifyHiddenColumns={modifyHiddenColumns}
        modifyColumnOrder={modifyColumnOrder}
      />
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
