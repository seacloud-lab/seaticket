/* eslint-disable react/prop-types */
import React, { useContext, useState } from 'react';

const SelectedRowsContext = React.createContext(null);

export const SelectedRowsProvider = ({
  children,
}) => {
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  return (
    <SelectedRowsContext.Provider
      value={{
        selectedRowIds,
        updateSelectedRowIds: setSelectedRowIds,
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
