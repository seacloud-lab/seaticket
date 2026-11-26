import React, { Fragment } from 'react';
import { gettext } from '@/constants';

const ModifyLog = ({ modifies }) => {
  return (
    <>
      {gettext('changed')}
      {' '}
      {modifies.map((modify, index) => {
        const { name, oldValue, newValue } = modify;
        return (
          <Fragment key={index}>
            {index > 0 && (<>{gettext('and')}{' '}</>)}
            {gettext('the {filed_name}').replace('{filed_name}', name)}
            {' '}
            {gettext('from')}
            {' '}
            {oldValue}
            {' '}
            {gettext('to')}
            {' '}
            {newValue}
          </Fragment>
        );
      })}
    </>
  );

};

export default ModifyLog;
