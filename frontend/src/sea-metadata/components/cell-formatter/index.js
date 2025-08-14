import React, { useMemo, isValidElement, cloneElement } from 'react';
import PropTypes from 'prop-types';
import Formatter from '../formatter';
import { useCollaborators } from '../../hooks';

const CellFormatter = ({ readonly, value, column, row, ...params }) => {
  const { collaborators, collaboratorsCache, updateCollaboratorsCache, queryUser } = useCollaborators();
  const props = useMemo(() => {
    return {
      collaborators,
      collaboratorsCache,
      updateCollaboratorsCache,
      readonly,
      value,
      column,
      queryUserAPI: queryUser,
      row,
    };
  }, [readonly, value, column, collaborators, collaboratorsCache, updateCollaboratorsCache, queryUser, row]);


  if (isValidElement(column.formatter)) {
    return (
      <>
        {cloneElement(column.formatter, { ...props, ...params })}
      </>
    );
  }

  return (
    <Formatter { ...props } { ...params } />
  );
};

CellFormatter.propTypes = {
  readonly: PropTypes.bool,
  value: PropTypes.any,
  column: PropTypes.object.isRequired,
  row: PropTypes.object,
};

export default CellFormatter;
