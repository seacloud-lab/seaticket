import React from 'react';
import { useConnectionsPage } from '../../hooks';
import Record from './record';
import Records from './records';

const Connection = (props) => {
  const { isLoading, childrenPageSlugId } = useConnectionsPage();

  if (isLoading) return null;

  return (
    <>
      {childrenPageSlugId ? (
        <Record { ...props } />
      ) : (
        <Records { ...props } />
      )}
    </>
  );
};

export default Connection;
