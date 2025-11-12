import React from 'react';
import PropTypes from 'prop-types';
import { toaster, List } from '@/components';
import userAPI from '@/api/user-api';
import { Utils } from '@/utils/utils';
import { isWorkWeChat } from '@/utils/wechat-utils';
import { siteRoot, gettext, avatarURL, useExternalTeamAdmin } from '@/constants';

import './index.css';

const Item = List.Item;

const propTypes = {
  isAdminPanel: PropTypes.bool
};

class MobileMine extends React.Component {

  isWorkWX = isWorkWeChat(window.navigator.userAgent.toLowerCase());

  constructor(props) {
    super(props);
    this.state = {
      showInfo: false,
      userName: '',
      contactEmail: '',
      isStaff: false,
      isOrgStaff: false,
    };
  }

  componentDidMount() {
    this.getAccountInfo();
  }

  getAccountInfo = () => {
    userAPI.getAccountInfo().then(resp => {
      this.setState({
        userName: resp.data.name,
        contactEmail: resp.data.email,
        isStaff: resp.data.is_staff,
        isInstAdmin: resp.data.is_inst_admin,
        isOrgStaff: resp.data.is_org_staff === 1 ? true : false,
        showInfo: !this.state.showInfo,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onClickListItem = (urlSuffix) => {
    const url = siteRoot + urlSuffix;
    location.href = url;
  };

  renderAvatar = () => {
    return (<img src={avatarURL} width="36" height="36" className="avatar" alt={gettext('Avatar')} />);
  };

  renderMenu = () => {
    let data;
    const { isStaff, isOrgStaff, isInstAdmin } = this.state;
    const { isAdminPanel = false } = this.props;

    if (isAdminPanel) {
      if (isStaff) {
        data = {
          url: '',
          text: gettext('Exit system admin')
        };
      } else if (isOrgStaff) {
        data = {
          url: '',
          text: gettext('Exit team admin')
        };
      } else if (isInstAdmin) {
        data = {
          url: '',
          text: gettext('Exit institution admin')
        };
      }

    } else {
      if (isStaff) {
        data = {
          url: 'sys/info/',
          text: gettext('System admin')
        };
      } else if (isOrgStaff) {
        data = {
          url: useExternalTeamAdmin ? 'external-team-admin/' : 'org/manage/',
          text: gettext('Team admin')
        };
      } else if (isInstAdmin) {
        data = {
          url: 'inst/users/',
          text: gettext('Institution admin')
        };
      }
    }
    return data;
  };

  render() {
    const { userName } = this.state;
    const data = this.renderMenu();
    return (
      <div className="mobile-mine">
        <List className="pt-4">
          <Item
            thumb={this.renderAvatar()}
            className='mine-info-item'
          >{userName}
          </Item>
        </List>

        <List className="mt-4">
          <Item
            onClick={this.onClickListItem.bind(this, 'profile')}
            arrow="horizontal"
          >
            {gettext('Personal settings')}
          </Item>
          {data &&
          <Item
            arrow="horizontal"
            className="system-management"
            onClick={this.onClickListItem.bind(this, data.url)}
          >
            {data.text}
          </Item>
          }
        </List>
        {!this.isWorkWX && (
          <List className="mt-4">
            <Item
              onClick={this.onClickListItem.bind(this, 'accounts/logout/')}
              arrow="horizontal"
            >
              {gettext('Log out')}
            </Item>
          </List>
        )}
      </div>
    );
  }

}

MobileMine.propTypes = propTypes;

export default MobileMine;
