import React from 'react';
import { gettext } from '@/constants';

const RemoveTip = ({ name, value }) => {
  return (
    <>
      {name || gettext('removed')}
      {value}
    </>
  );
};

export default RemoveTip;
