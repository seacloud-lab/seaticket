import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import AsyncCollaborator from './async-collaborator';
import Collaborator from './collaborator';
import { hasOwnProperty } from '@/utils/object-utils';

const CollaboratorsFormatter = ({ value, className, children: emptyFormatter, column, ...params }) => {
  if (!Array.isArray(value) || value.length === 0) return emptyFormatter || null;
  const validValue = value.filter(item => item);
  if (validValue.length === 0) return emptyFormatter || null;
  return (
    <div className={classnames('sea-metadata-ui cell-formatter-container collaborators-formatter', className)}>
      {hasOwnProperty(column?.data || {}, 'collaborators') && Array.isArray(column.data.collaborators) ? (
        <>
          {value.map(email => {
            let collaborator = column.data.collaborators.find(c => c.email === email);
            if (!collaborator) {
              collaborator = {
                email: email,
                name: email,
              };
            }
            return (<Collaborator key={email} collaborator={collaborator} />);
          })}
        </>
      ) : (
        <>
          {value.map(email => <AsyncCollaborator key={email} { ...params } value={email} />)}
        </>
      )}
    </div>
  );
};

CollaboratorsFormatter.propTypes = {
  value: PropTypes.array,
  className: PropTypes.string,
  children: PropTypes.any,
};

export default CollaboratorsFormatter;
