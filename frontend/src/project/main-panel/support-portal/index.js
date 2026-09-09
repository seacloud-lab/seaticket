import React from 'react';
import TopBar from '../top-bar';
import View from './view';

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
