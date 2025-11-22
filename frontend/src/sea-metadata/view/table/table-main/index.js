import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Rows from './rows';
import GridUtils from '../utils/grid-utils';
import { GROUP_VIEW_OFFSET } from '../../../constants';

import './index.css';

const TableMain = ({
  metadata, tagsData, collaborators,
  modifyRow, modifyRows, loadMore, searchResult, rowGetterByIndex, rowGetterById, insertColumn,
  modifyColumnData, updateFileTags,
  ...props
}) => {

  const gridUtils = useMemo(() => {
    return new GridUtils(metadata, {
      modifyRow,
      modifyRows,
      rowGetterByIndex,
      rowGetterById,
      modifyColumnData,
      updateFileTags,
    });
  }, [metadata, modifyRow, modifyRows, rowGetterByIndex, rowGetterById, modifyColumnData, updateFileTags]);

  const groupbysCount = useMemo(() => {
    const groupbys = metadata?.view?.groupbys || [];
    return groupbys.length;
  }, [metadata]);

  const groupOffset = useMemo(() => {
    return groupbysCount * GROUP_VIEW_OFFSET;
  }, [groupbysCount]);

  const columns = useMemo(() => {
    const { hidden_columns, columns: allColumns } = metadata.view;

    return allColumns.filter(column => !hidden_columns.includes(column.key));
  }, [metadata.view.hidden_columns, metadata.view.columns]);

  const getCopiedRowsAndColumnsFromRange = useCallback(({ type, copied, isGroupView }) => {
    return gridUtils.getCopiedContent({ type, copied, isGroupView, columns });
  }, [gridUtils, columns]);

  const updateRow = useCallback(({ rowId, rowUpdate, oldRowData }) => {
    modifyRow && modifyRow(rowId, rowUpdate, oldRowData);
  }, [modifyRow]);

  const handleInsertColumn = useCallback((name, type, { key, data }) => {
    insertColumn && insertColumn(name, type, { key, data });
  }, [insertColumn]);

  const paste = useCallback(({ type, copied, multiplePaste, pasteRange, isGroupView, pasteSource, cutPosition, viewId }) => {
    gridUtils.paste({ type, copied, multiplePaste, pasteRange, isGroupView, columns, pasteSource, cutPosition, viewId, tagsData, collaborators });
  }, [gridUtils, columns]);

  return (
    <div className={classnames('sea-metadata-table-main-container container-fluid p-0', { [`group-level-${groupbysCount + 1}`]: groupbysCount > 0 })}>
      <Rows
        columns={columns}
        rowIds={metadata.view.rows || []}
        groups={metadata.view.groups}
        groupbys={metadata.view.groupbys}
        rowsCount={metadata?.view?.rows?.length || 0}
        rowHeight={metadata.view.row_height}
        table={metadata}
        tagsData={tagsData}
        collaborators={collaborators}
        hasMore={metadata.hasMore}
        gridUtils={gridUtils}
        loadMore={loadMore}
        paste={paste}
        groupOffsetLeft={groupOffset}
        modifyRow={updateRow}
        deleteRows={props.deleteRows}
        getCopiedRowsAndColumnsFromRange={getCopiedRowsAndColumnsFromRange}
        rowGetterById={rowGetterById}
        rowGetterByIndex={rowGetterByIndex}
        modifyColumnData={modifyColumnData}
        insertColumn={handleInsertColumn}
        updateFileTags={updateFileTags}
        modifyRows={modifyRows}
        {...props}
      />
    </div>
  );

};

TableMain.propTypes = {
  metadata: PropTypes.object.isRequired,
  modifyRow: PropTypes.func,
  modifyRows: PropTypes.func,
  loadMore: PropTypes.func,
  searchResult: PropTypes.object,
};

export default TableMain;
