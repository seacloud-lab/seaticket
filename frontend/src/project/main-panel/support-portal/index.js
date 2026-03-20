import React from 'react';
import TopBar from './top-bar';
import View from './view';

const { projectUuid, permission } = window.app.pageOptions;

const SupportPortal = ({ title }) => {
  return (
    <>
      <TopBar title={title} />
      <View projectUuid={projectUuid} permission={permission} />
    </>
  );
};

export default SupportPortal;
