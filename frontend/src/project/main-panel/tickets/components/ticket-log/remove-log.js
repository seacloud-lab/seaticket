import React from 'react';
import { gettext } from '@/constants';

const RemoveLog = ({ name, value }) => {
  return (
    <>
      {name || gettext('removed')}
      {value}
    </>
  );
};

export default RemoveLog;
