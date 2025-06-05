import React from 'react';
import { Router } from '@gatsbyjs/reach-router';
import TemplateModule from './template-module/template-module';
import { siteRoot } from '../../utils/constants';

class MainPanel extends React.Component {

  render() {
    return (
      <div id="content" className="plugin-market-content">
        <Router className="reach-router" role='group'>
          <TemplateModule path={siteRoot} />
          <TemplateModule path={siteRoot + 'templates/'} />
        </Router>
      </div>
    );
  }
}

export default MainPanel;
