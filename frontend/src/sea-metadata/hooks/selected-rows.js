/* eslint-disable react/prop-types */
import React, { useCallback, useContext, useState } from 'react';

const SelectedRowsContext = React.createContext(null);

export const SelectedRowsProvider = ({
  children,
}) => {
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  const updateSelectedRowIdsByDelete = useCallback((deletedRowIds = []) => {
    const newSelectedRowIds = selectedRowIds.filter(id => !deletedRowIds.includes(id));
    setSelectedRowIds(newSelectedRowIds);
  }, [selectedRowIds]);

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
