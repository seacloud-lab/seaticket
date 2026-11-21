import React, { Fragment, useCallback, useMemo } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { Collaborator, UserAvatar } from '@/components';
import AsyncCollaborator from '@/components/collaborator/async-collaborator';
import { parseEmailAddress } from '@/utils/email';
import { hasOwnProperty } from '@/utils/object-utils';
import { isObject } from '@/utils/type-detection';

import './index.css';

const CollaboratorsFormatter = ({ value, className, children: emptyFormatter, isSimple = false, column, ...params }) => {
  const validValue = useMemo(() => {
    if (!Array.isArray(value) || value.length === 0) return [];
    return value.filter(Boolean);
  }, [value]);

  const isEmailUser = useMemo(() => hasOwnProperty(column?.data || {}, 'is_email_user') && column?.data?.is_email_user, [column]);
  const collaboratorsCount = useMemo(() => validValue.length, [validValue]);

  const renderChildren = useCallback(() => {
    if (hasOwnProperty(column?.data || {}, 'collaborators') && Array.isArray(column.data.collaborators)) {
      return (
        <>
          {validValue.map(email => {
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
      );
    }

    if (isEmailUser && isSimple) {
      const firstValue = validValue[0];
      const { name, email } = parseEmailAddress(firstValue);
      return (
        <>
          <UserAvatar user={{ name, email, fullName: '' }} size={20} />
          {collaboratorsCount > 1 && (
            <div className="collaborators-simple-formatter-count d-flex align-items-center justify-content-center position-absolute">
              {`+${collaboratorsCount}`}
            </div>
          )}
        </>
      );
    }

    return (
      <>
        {validValue.map(emailOrUser => {
          if (isObject(emailOrUser)) return (<Collaborator key={emailOrUser?.email} collaborator={emailOrUser} />);
          return (<AsyncCollaborator key={emailOrUser} { ...params } value={emailOrUser} isEmailUser={isEmailUser} />);
        })}
      </>
    );
  }, [validValue, column, isSimple, params, isEmailUser, collaboratorsCount]);

  if (validValue.length === 0) return emptyFormatter || null;

  return (
    <div
      className={classnames('sea-metadata-ui cell-formatter-container collaborators-formatter', className, {
        'position-relative': isEmailUser && isSimple && collaboratorsCount > 1
      })}
    >
      {renderChildren()}
    </div>
  );
};

CollaboratorsFormatter.propTypes = {
  value: PropTypes.array,
  className: PropTypes.string,
  children: PropTypes.any,
};

export default CollaboratorsFormatter;
