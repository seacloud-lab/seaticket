import React from 'react';
import { createRoot } from 'react-dom/client';
import { globalHistory, LocationProvider } from '@gatsbyjs/reach-router';
import HeaderPanel from './header-panel';
import MainPanel from './main-panel';

import './css/market-layout.css';

class AppTemplates extends React.Component {

  render() {

    return (
      <div id="main">
        <HeaderPanel></HeaderPanel>
        <MainPanel></MainPanel>
      </div>
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <LocationProvider history={globalHistory}>
    <AppTemplates />
  </LocationProvider>
);
