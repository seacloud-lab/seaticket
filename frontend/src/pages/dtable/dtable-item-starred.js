import React from 'react';
import PropTypes from 'prop-types';
import { Utils } from '../../utils/utils';
import DTableItem from './dtable-item';

const gettext = window.gettext;
const { siteRoot } = window.app.config;

const propTypes = {
  table: PropTypes.object.isRequired,
  path: PropTypes.string.isRequired,
};

class DTableItemStarred extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      active: false,
    };
  }

  onMouseEnter = () => {
    this.setState({ active: true });
  };

  onMouseLeave = () => {
    this.setState({ active: false });
  };

  onTableItemClick = (e, href) => {
    Utils.openPage(e, href);
  };

  renderName = (tableName, tableHref, isDesktop, isEncrypted) => {
    let { path } = this.props;
    const pathName = path === 'personal' ? gettext('My projects') : path;
    return (
      <div className={`${isDesktop ? 'table-name' : 'table-mobile-name'}`}>
        <a href={tableHref} className="table-href">{tableName}</a>
        {path &&
          <span className="share-tip text-truncate" style={{ maxWidth: 'unset' }}>{pathName}</span>
        }
        {isEncrypted && <i className='dtable-font dtable-icon-unlock star'></i>}
      </div>
    );
  };

  render() {
    let { table } = this.props;
    let { active } = this.state;
    let { name, workspace_id, color, icon, is_encrypted } = table;
    let tableHref = siteRoot + 'workspace/' + workspace_id + '/dtable/' + encodeURIComponent(name) + '/';
    const isDesktop = Utils.isDesktop();
    if (isDesktop) {
      return (
        <div
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}
          onClick={(e) => this.onTableItemClick(e, tableHref)}
          className={`table-item ${active ? 'tr-highlight' : ''}`}
        >
          <DTableItem dtableColor={color} dtableIcon={icon} />
          {this.renderName(name, tableHref, isDesktop, is_encrypted)}
        </div>
      );
    }
    return (
      <div
        className="table-mobile-item"
        onClick={(e) => this.onTableItemClick(e, tableHref)}
      >
        <DTableItem dtableColor={color} dtableIcon={icon} className="table-mobile-icon"/>
        {this.renderName(name, tableHref, isDesktop, is_encrypted)}
      </div>
    );
  }
}

DTableItemStarred.propTypes = propTypes;

export default DTableItemStarred;
