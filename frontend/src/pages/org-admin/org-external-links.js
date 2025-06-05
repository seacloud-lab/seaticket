import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../utils/constants';
import MainPanelTopbar from './main-panel-topbar';
import OrgDTableExternalLinks from './org-dtable-external-links';
import OrgViewExternalLinks from './org-view-external-links';

const OrgExternalLinksPropTypes = {
  currentTab: PropTypes.string.isRequired,
  onCloseSidePanel: PropTypes.func,
  tabItemClick: PropTypes.func.isRequired
};


class OrgExternalLinks extends React.Component {
  constructor(props) {
    super(props);
    this.state = ({
      isShowDTableIODialog: false,
      IOTaskId: 0,
      currentExportingTable: null,
      isShowTrashEmptyConfirmDialog: false
    });
  }

  tabItemClick = (tab) => {
    this.props.tabItemClick(tab);
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
        <MainPanelTopbar children={topbarChildren} onCloseSidePanel={this.props.onCloseSidePanel}/>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <div className="cur-view-path org-user-nav tab-nav-container">
              <ul className="nav">
                <li className="nav-item" onClick={() => this.tabItemClick('dtablelinkex')}>
                  <span className={`nav-link ${this.props.currentTab === 'dtablelinkex' ? 'active' : ''}`}>{gettext('Base external links')}</span>
                </li>
                <li className="nav-item" onClick={() => this.tabItemClick('viewlinkex')}>
                  <span className={`nav-link ${this.props.currentTab === 'viewlinkex' ? 'active' : ''}`} >{gettext('View external links')}</span>
                </li>
              </ul>
            </div>
            {this.props.currentTab === 'dtablelinkex' &&
              <OrgDTableExternalLinks/>
            }
            {this.props.currentTab === 'viewlinkex' &&
              <OrgViewExternalLinks/>
            }
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgExternalLinks.propTypes = OrgExternalLinksPropTypes;

export default OrgExternalLinks;
