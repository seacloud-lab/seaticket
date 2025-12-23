import React, { useEffect } from 'react';
import Row from './row';

const Rows = ({ rows, rowsDidMount, rowsWillUnmount, ...params }) => {

  useEffect(() => {
    rowsDidMount && rowsDidMount(rows);
  }, [rows]);

  useEffect(() => {
    return () => {
      rowsWillUnmount && rowsWillUnmount();
    };
  }, []);

  return rows.map(row => (<Row key={row.id} row={row} { ...params } />));
};

export default Rows;
