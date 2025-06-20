import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { navigate } from '@gatsbyjs/reach-router';
import OrgNormalProjects from './org-normal-projects';
import { gettext } from '../../constants';
import MainPanelTopbar from './main-panel-topbar';
import OrgTrashProjects from './org-trash-projects';
import Search from '../sys-admin/search';

const siteRoot = window.app.config.siteRoot;

const OrgProjectsPropTypes = {
  currentTab: PropTypes.string.isRequired,
  onCloseSidePanel: PropTypes.func,
  tabItemClick: PropTypes.func.isRequired
};


class OrgProjects extends React.Component {
  constructor(props) {
    super(props);
    this.state = ({
      isShowTrashEmptyConfirmDialog: false,
    });
  }

  tabItemClick = (tab) => {
    this.props.tabItemClick(tab);
  };

  onTrashEmptyConfirmDialogToggle = () => {
    this.setState({ isShowTrashEmptyConfirmDialog: !this.state.isShowTrashEmptyConfirmDialog });

  };

  getSearch = () => {
    return <Search
      placeholder={gettext('Search bases')}
      submit={this.searchItems}
    />;
  };

  searchItems = (keyword) => {
    navigate(`${siteRoot}org/search-dtables/?query=${encodeURIComponent(keyword)}`);
  };

  render() {
    const topBtn = 'btn btn-secondary operation-item';
    let topbarChildren;
    if (this.props.currentTab === 'trash') {
      topbarChildren = (
        <Fragment>
          <button className={topBtn} title={gettext('Clean')} aria-label={gettext('Clean')} onClick={this.onTrashEmptyConfirmDialogToggle}>
            {gettext('Clean')}
          </button>
        </Fragment>
      );
    }
    return (
      <Fragment>
        <MainPanelTopbar children={topbarChildren} onCloseSidePanel={this.props.onCloseSidePanel} search={this.getSearch()} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <div className="cur-view-path org-user-nav tab-nav-container">
              <ul className="nav">
                <li className="nav-item" onClick={() => this.tabItemClick('projects')}>
                  <span className={`nav-link ${this.props.currentTab === 'projects' ? 'active' : ''}`}>{gettext('projects')}</span>
                </li>
                <li className="nav-item" onClick={() => this.tabItemClick('trash')}>
                  <span className={`nav-link ${this.props.currentTab === 'trash' ? 'active' : ''}`} >{gettext('Trash')}</span>
                </li>
              </ul>
            </div>
            {this.props.currentTab === 'projects' &&
              <OrgNormalProjects/>
            }
            {this.props.currentTab === 'trash' &&
              <OrgTrashProjects
                isShowTrashEmptyConfirmDialog={this.state.isShowTrashEmptyConfirmDialog}
                onTrashEmptyConfirmDialogToggle={this.onTrashEmptyConfirmDialogToggle}
              />
            }
          </div>
        </div>

      </Fragment>
    );
  }
}

OrgProjects.propTypes = OrgProjectsPropTypes;

export default OrgProjects;
