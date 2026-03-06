import React from 'react';
import { gettext } from '@/constants';

const ModifyTip = ({ name, oldValue, newValue }) => {
  return (
    <>
      {gettext('changed the {filed_name}').replace('{filed_name}', name)}
      {' '}
      {gettext('from')}
      {' '}
      {oldValue}
      {' '}
      {gettext('to')}
      {' '}
      {newValue}
    </>
  );

};

export default ModifyTip;
