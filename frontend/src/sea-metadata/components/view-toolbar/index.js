import React, { useCallback } from 'react';
import { EVENT_BUS_TYPE, VIEW_TYPE, VIEW_TOOLS, VIEW_TOOL } from '../../constants';
import TableViewToolbar from './table-view-toolbar';
import { useCollaborators, useMetadata, useSelectedRows } from '../../hooks';
import context from '../../context';
import Views from './views';
import RowsToolbar from './rows-toolbar';
import { getRowsByIds } from '@/sea-metadata/utils/row';

import './index.css';

const ViewToolBar = ({ fixedColumnCount, tools = VIEW_TOOLS, createRowsTools, toggleView }) => {

  const { collaborators } = useCollaborators();
  const { metadata, modifyFilters, modifySorts, modifyGroupbys, modifyRowColor, modifyRowHeight, modifyHiddenColumns, modifyColumnOrder,
    searchRows, deleteRow, deleteRows, modifyRows, updateLocalRow, deleteLocalRows, modifyViewLock,
  } = useMetadata();
  const { selectedRowIds, updateSelectedRowIds } = useSelectedRows();

  const selectNone = useCallback((event) => {
    event && event.stopPropagation();
    event && event.nativeEvent && event.nativeEvent.stopImmediatePropagation();
    updateSelectedRowIds([]);
    context.eventBus.dispatch(EVENT_BUS_TYPE.SELECT_NONE);
  }, [updateSelectedRowIds]);

  const onHeaderClick = useCallback(() => {
    selectNone();
  }, [selectNone]);

  const renderLeftTools = useCallback((view) => {
    if (selectedRowIds.length > 0 && tools.includes(VIEW_TOOL.ROWS_TOOLS)) {
      const rows = getRowsByIds(metadata, selectedRowIds);
      return (
        <RowsToolbar
          rows={rows}
          columns={metadata?.columns || []}
          selectNone={selectNone}
          deleteRow={deleteRow}
          deleteRows={deleteRows}
          deleteLocalRows={deleteLocalRows}
          modifyRows={modifyRows}
          updateLocalRow={updateLocalRow}
          createTools={createRowsTools}
        />
      );
    }
    if (tools.includes(VIEW_TOOL.VIEWS)) {
      return (<Views view={view} toggleView={toggleView} />);
    }
    return (<div className="sea-metadata-views"></div>);
  }, [selectedRowIds, tools, metadata, createRowsTools, toggleView, deleteRows, modifyRows, deleteLocalRows, deleteRow, selectNone, updateLocalRow]);

  const view = metadata?.view;
  const viewType = view?.type;
  const readOnly = view && context.canModifyView ? !context.canModifyView(view) : true;
  const isShowViews = context.getSetting('isShowViews', true);
  if (!isShowViews) return null;

  return (
    <div className="sea-metadata-view-ribbon" onClick={onHeaderClick}>
      {renderLeftTools(view)}
      <div className="sea-metadata-view-tools">
        {view && (
          <>
            {viewType === VIEW_TYPE.TABLE && (
              <TableViewToolbar
                readOnly={readOnly}
                tools={tools}
                fixedColumnCount={fixedColumnCount}
                view={view}
                collaborators={collaborators}
                modifyFilters={modifyFilters}
                modifySorts={modifySorts}
                modifyGroupbys={modifyGroupbys}
                modifyRowColor={modifyRowColor}
                modifyRowHeight={modifyRowHeight}
                modifyHiddenColumns={modifyHiddenColumns}
                modifyColumnOrder={modifyColumnOrder}
                modifyViewLock={modifyViewLock}
                searchRows={searchRows}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ViewToolBar;
