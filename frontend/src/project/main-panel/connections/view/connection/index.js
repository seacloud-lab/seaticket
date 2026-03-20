import React from 'react';
import Records from './records';
import Record from './record';
import { useConnectionsPage } from '../../hooks';

const Connection = (props) => {
  const { isLoading, childrenPageSlugId, onRefresh } = useConnectionsPage();

  if (isLoading) return null;

  return (
    <>
      {childrenPageSlugId ? (
        <Record { ...props } />
      ) : (
        <Records { ...props } onRefresh={onRefresh} />
      )}
    </>
  );
};

export default Connection;
