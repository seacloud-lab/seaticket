import React, { useEffect } from 'react';
import Row from './row';

const Rows = ({ rows, rowsDidMount, rowsWillUnmount, ...params }) => {

  useEffect(() => {
    rowsDidMount && rowsDidMount(rows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(() => {
    return () => {
      rowsWillUnmount && rowsWillUnmount();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return rows.map(row => (<Row key={row.id} row={row} { ...params } />));
};

export default Rows;
