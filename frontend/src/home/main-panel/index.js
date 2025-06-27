import React from 'react';
import PropTypes from 'prop-types';
import PCMainPanel from './pc-main-panel';
import MBMainPanel from './mb-main-panel';

const MainPanel = ({ isDesktop, currentTab, ...props }) => {

  if (isDesktop) {
    return (<PCMainPanel currentTab={currentTab} { ...props } />);
  }

  return (<MBMainPanel { ...props } />);
};

MainPanel.propTypes = {
  isDesktop: PropTypes.bool,
  currentTab: PropTypes.string,
};

export default MainPanel;
