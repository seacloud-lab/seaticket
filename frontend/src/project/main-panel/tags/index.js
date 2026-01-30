import React from 'react';
import TopBar from './top-bar';
import View from './view';

const { projectUuid, permission } = window.app.pageOptions;

const AllTags = ({ title }) => {
  return (
    <>
      <TopBar title={title} permission={permission} />
      <View permission={permission} projectUuid={projectUuid} />
    </>
  );

};

export default AllTags;
