/* eslint-disable react/prop-types */
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { EVENT_BUS_TYPE } from '../constants';
import { useSeaMetadataContext } from '../context-provider';

const SelectedRowsContext = React.createContext(null);

export const SelectedRowsProvider = ({
  children,
}) => {
  const context = useSeaMetadataContext();
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  const updateSelectedRowIdsByDelete = useCallback((deletedRowIds = []) => {
    setSelectedRowIds(ids => ids.filter(id => !deletedRowIds.includes(id)));
  }, []);

  useEffect(() => {
    const unsubscribeSelectNone = context.eventBus.subscribe(EVENT_BUS_TYPE.SELECT_NONE, () => {
      setSelectedRowIds([]);
    });

    return () => {
      unsubscribeSelectNone();
    };
  }, [context]);

  return (
    <SelectedRowsContext.Provider
      value={{
        selectedRowIds,
        updateSelectedRowIds: setSelectedRowIds,
        updateSelectedRowIdsByDelete,
      }}
    >
      {children}
    </SelectedRowsContext.Provider>
  );
};

export const useSelectedRows = () => {
  const context = useContext(SelectedRowsContext);
  if (!context) {
    throw new Error('\'SelectedRowsContext\' is null');
  }
  return context;
};
