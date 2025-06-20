import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import MobileCommonHeader from './mobile-common-header';
import ShareTableToUser from './share-widgets/share-table-to-user';
import ShareTableToGroup from './share-widgets/share-table-to-group';
import { Utils } from '../../../utils/utils';
import Loading from '../../../components/loading';
import ExternalLink from './share-widgets/external-link';
import InviteLink from './share-widgets/invite-link';
import { seaQAAPI } from '../../../api/web-api';
import { gettext, cloudMode, isOrgContext } from '../../../constants/config';

import '../../../css/mobile/mobile-share-table.css';

const propTypes = {
  currentTable: PropTypes.object.isRequired,
  hideMobileShareTable: PropTypes.func,
};

class MobileShareTable extends Component {

  constructor(props) {
    super(props);
    this.state = {
      activeTab: 'shareToUser',
      customSharePermissions: [],
      isLoading: true
    };
  }

  componentDidMount() {
    const { workspace_id, name } = this.props.currentTable;
    seaQAAPI.getSharePermissions(workspace_id, name).then((res) => {
      const customSharePermissions = res.data.permission_list;
      this.setState({ customSharePermissions, isLoading: false });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
      this.setState({ isLoading: false });
    });
  }

  onSelectedActiveTab = (tab) => {
    if (this.state.activeTab !== tab) {
      this.setState({ activeTab: tab });
    }
  };

  toggle = () => {
    this.props.hideMobileShareTable();
  };

  render() {
    const { currentTable } = this.props;
    const { activeTab, customSharePermissions, isLoading } = this.state;
    const title = (
      <>
        <span className="mr-1">{gettext('Share')}</span>
        <span className="mobile-share-title-name">{currentTable.name}</span>
      </>
    );
    return (
      <div className="mobile-share-table">
        <MobileCommonHeader
          title={title}
          titleClass='mobile-share-header'
          onLeftClick={this.toggle}
          leftName={<i className="dtable-font dtable-icon-return" />}
        />
        {isLoading ?
          <Loading /> :
          <>
            <div className="share-table-side">
              <div className="share-table-tabs">
                <ul className="share-nav-tabs">
                  <li
                    className={`share-nav-item ${activeTab === 'shareToUser' ? 'share-nav-item-active' : ''}`}
                    onClick={this.onSelectedActiveTab.bind(this, 'shareToUser')}
                  >
                    {gettext('Share to user')}
                  </li>
                  {(!cloudMode || isOrgContext) && (
                    <li
                      className={`share-nav-item ${activeTab === 'shareToGroup' ? 'share-nav-item-active' : ''}`}
                      onClick={this.onSelectedActiveTab.bind(this, 'shareToGroup')}
                    >
                      {gettext('Share to group')}
                    </li>
                  )}
                  <li
                    className={`share-nav-item ${activeTab === 'inviteLink' ? 'share-nav-item-active' : ''}`}
                    onClick={this.onSelectedActiveTab.bind(this, 'inviteLink')}
                  >
                    {gettext('Invite link')}
                  </li>
                  <li className={`share-nav-item ${activeTab === 'externalLink' ? 'share-nav-item-active' : ''}`}
                    onClick={this.onSelectedActiveTab.bind(this, 'externalLink')}
                  >
                    {gettext('External link')}
                  </li>
                </ul>
              </div>
            </div>
            {activeTab === 'shareToUser' &&
              <ShareTableToUser customSharePermissions={customSharePermissions} currentTable={this.props.currentTable} />
            }
            {(!cloudMode || isOrgContext) && activeTab === 'shareToGroup' &&
              <ShareTableToGroup customSharePermissions={customSharePermissions} currentTable={this.props.currentTable} />
            }
            {activeTab === 'externalLink' &&
              <ExternalLink currentTable={this.props.currentTable} />
            }
            {activeTab === 'inviteLink' &&
              <InviteLink currentTable={this.props.currentTable} />
            }
          </>
        }
      </div>
    );
  }
}

MobileShareTable.propTypes = propTypes;

export default MobileShareTable;
