import React, { useCallback } from 'react';
import { EVENT_BUS_TYPE, VIEW_TYPE } from '../../constants';
import TableViewToolbar from './table-view-toolbar';
import { useCollaborators, useMetadata } from '../../hooks';
import context from '../../context';
import Views from './views';

import './index.css';

const ViewToolBar = ({ toggleView }) => {

  const { collaborators } = useCollaborators();
  const { isLoading, metadata, modifyFilters, modifySorts, modifyGroupbys, modifyHiddenColumns, modifyColumnOrder } = useMetadata();

  const onHeaderClick = useCallback(() => {
    context.eventBus.dispatch(EVENT_BUS_TYPE.SELECT_NONE);
  }, []);

  const view = metadata?.view;
  const viewType = view?.type;
  const readOnly = !isLoading && context.canModifyView ? !context.canModifyView(view) : true;

  return (
    <div className="sea-metadata-view-ribbon" onClick={onHeaderClick}>
      <Views view={view} toggleView={toggleView} />
      <div className="sea-metadata-view-tools">
        {!isLoading && (
          <>
            {viewType === VIEW_TYPE.TABLE && (
              <TableViewToolbar
                readOnly={readOnly}
                view={view}
                collaborators={collaborators}
                modifyFilters={modifyFilters}
                modifySorts={modifySorts}
                modifyGroupbys={modifyGroupbys}
                modifyHiddenColumns={modifyHiddenColumns}
                modifyColumnOrder={modifyColumnOrder}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ViewToolBar;
