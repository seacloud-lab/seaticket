import React, { useCallback } from 'react';
import { EVENT_BUS_TYPE, VIEW_TYPE, VIEW_TOOLS } from '../../constants';
import TableViewToolbar from './table-view-toolbar';
import { useCollaborators, useMetadata } from '../../hooks';
import context from '../../context';
import Views from './views';

import './index.css';

const ViewToolBar = ({ tools = VIEW_TOOLS, toggleView }) => {

  const { collaborators } = useCollaborators();
  const { isLoading, metadata, modifyFilters, modifySorts, modifyGroupbys, modifyHiddenColumns, modifyColumnOrder, searchRows } = useMetadata();

  const onHeaderClick = useCallback(() => {
    context.eventBus.dispatch(EVENT_BUS_TYPE.SELECT_NONE);
  }, []);

  const view = metadata?.view;
  const viewType = view?.type;
  const readOnly = !isLoading && context.canModifyView ? !context.canModifyView(view) : true;

  return (
    <div className="sea-metadata-view-ribbon" onClick={onHeaderClick}>
      {tools.includes('views') ? (
        <Views view={view} toggleView={toggleView} />
      ) : (
        <div className="sea-metadata-views"></div>
      )}
      <div className="sea-metadata-view-tools">
        {!isLoading && (
          <>
            {viewType === VIEW_TYPE.TABLE && (
              <TableViewToolbar
                readOnly={readOnly}
                tools={tools}
                view={view}
                collaborators={collaborators}
                modifyFilters={modifyFilters}
                modifySorts={modifySorts}
                modifyGroupbys={modifyGroupbys}
                modifyHiddenColumns={modifyHiddenColumns}
                modifyColumnOrder={modifyColumnOrder}
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
