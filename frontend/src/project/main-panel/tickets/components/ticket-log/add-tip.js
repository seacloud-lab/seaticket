import React from 'react';
import { gettext } from '@/constants';

const AddTip = ({ name, value }) => {
  return (
    <>
      {name || gettext('added')}
      {value}
    </>
  );
};

export default AddTip;
