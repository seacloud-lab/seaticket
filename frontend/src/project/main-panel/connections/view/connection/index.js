import React from 'react';
import { DataCacheProvider } from '@/sea-metadata';
import Records from './records';
import Record from './record';
import { useConnectionsPage } from '../../hooks';
import { MetadataProvider } from '../../../tickets/hooks';

const Connection = (props) => {
  const { isLoading, childrenPageSlugId } = useConnectionsPage();

  if (isLoading) return null;

  return (
    <DataCacheProvider>
      <MetadataProvider projectUuid={props.projectUuid} >
        {childrenPageSlugId ? (
          <Record { ...props } />
        ) : (
          <Records { ...props } />
        )}
      </MetadataProvider>
    </DataCacheProvider>
  );
};

export default Connection;
