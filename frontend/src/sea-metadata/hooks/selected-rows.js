/* eslint-disable react/prop-types */
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { EVENT_BUS_TYPE } from '../constants';
import context from '../context';

const SelectedRowsContext = React.createContext(null);

export const SelectedRowsProvider = ({
  children,
}) => {
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  const updateSelectedRowIdsByDelete = useCallback((deletedRowIds = []) => {
    const newSelectedRowIds = selectedRowIds.filter(id => !deletedRowIds.includes(id));
    setSelectedRowIds(newSelectedRowIds);
  }, [selectedRowIds]);

  useEffect(() => {
    const unsubscribeSelectNone = context.eventBus.subscribe(EVENT_BUS_TYPE.SELECT_NONE, () => {
      setSelectedRowIds([]);
    });

    return () => {
      unsubscribeSelectNone();
    };
  }, []);

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
