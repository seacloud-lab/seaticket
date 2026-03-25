import React from 'react';
import View from './view';
import TopBar from '../top-bar';

const SupportPortal = ({ title }) => {
  return (
    <>
      <TopBar>
        <span className="text-truncate" title={title}>{title}</span>
      </TopBar>
      <View />
    </>
  );
};

export default SupportPortal;
