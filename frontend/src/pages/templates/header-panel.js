import React from 'react';
import { Link } from '@gatsbyjs/reach-router';
import { mediaUrl, siteRoot, gettext, logoPath, logoHeight, logoWidth, siteTitle } from '../../utils/constants';
import { Utils } from '../../utils/utils';

class HeaderPanel extends React.Component {

  render() {
    const templates = gettext('Templates');
    const isDesktop = Utils.isDesktop();
    let logoUrl = logoPath.startsWith('http') ? logoPath : mediaUrl + logoPath;
    return (
      <div id="header" className="plugin-market-header">
        {isDesktop &&
        <a className="dtable-logo" href={siteRoot}>
          <img
            src={logoUrl}
            height={logoHeight}
            width={logoWidth}
            title={siteTitle}
            alt={gettext('SeaTable logo')}
            aria-label={gettext('SeaTable logo')}
          />
        </a>
        }
        <div className="plugin-toolbar">
          <Link
            to={siteRoot + 'templates'}
            className="plugin-toolbar-item"
            style={{
              color: '#efa350',
              borderBottom: '2px solid #efa350',
            }}
          >{templates}
          </Link>
        </div>
      </div>
    );
  }
}

export default HeaderPanel;
