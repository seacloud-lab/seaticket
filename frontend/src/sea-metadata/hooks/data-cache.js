import React, { useCallback, useContext, useState } from 'react';
import { getTableColumnByName } from '../utils/table';

const DataCacheContext = React.createContext(null);

export const DataCacheProvider = ({ children }) => {
  const [data, setData] = useState(null);

  const cacheData = useCallback((data) => {
    setData({
      create_at: new Date(),
      ...data,
    });
  }, []);

  const updateCacheData = useCallback((type, key, update, convertToKeyValue = false) => {
    if (!data) return;
    let newData = { ...data };
    if (type === 'rows') {
      const newRows = newData.rows.slice(0);
      const rowIndex = newRows.findIndex(r => r._id === key);
      if (rowIndex === -1) return;
      let row = newRows[rowIndex];
      Object.keys(update).forEach(rowKey => {
        if (convertToKeyValue) {
          const column = getTableColumnByName(newData, rowKey);
          row[column.key] = update[rowKey];
        } else {
          row[rowKey] = update[rowKey];
        }
      });
      newRows[rowIndex] = row;
      newData.rows = newRows;
    }
    setData(newData);
  }, [data]);

  const clearCacheData = useCallback(() => {
    setData(null);
  }, []);

  return (
    <DataCacheContext.Provider value={{
      cachedData: data,
      cacheData,
      clearCacheData,
      updateCacheData,
    }}>
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('\'DataCacheContext\' is null');
  }
  return context;
};
