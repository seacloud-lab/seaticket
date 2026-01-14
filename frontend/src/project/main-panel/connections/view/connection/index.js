import React from 'react';
import { DataCacheProvider } from '@/sea-metadata';
import Records from './records';
import Record from './record';
import { useConnectionsPage } from '../../hooks';

const Connection = (props) => {
  const { isLoading, childrenPageSlugId } = useConnectionsPage();

  if (isLoading) return null;

  return (
    <DataCacheProvider>
      {childrenPageSlugId ? (
        <Record { ...props } />
      ) : (
        <Records { ...props } />
      )}
    </DataCacheProvider>
  );
};

export default Connection;
