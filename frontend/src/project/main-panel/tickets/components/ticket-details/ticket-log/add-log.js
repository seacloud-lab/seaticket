import React from 'react';
import { gettext } from '@/constants';

const AddLog = ({ name, value }) => {
  return (
    <>
      {name || gettext('added')}
      {value}
    </>
  );
};

export default AddLog;
