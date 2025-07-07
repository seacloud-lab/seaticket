import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import copy from 'copy-to-clipboard';
import { List, ActionSheet, toaster, IconButton } from '../../../components';
import { Utils } from '../../../utils/utils';
import AddInviteLink from './add-invite-link';
import ShareAddedBtn from './share-add-btn';
import { gettext } from '../../../constants/config';
import { seaQAAPI } from '../../../api/web-api';
import ShareUtils from './share-utils';

const Item = List.Item;
const Brief = Item.Brief;

const propTypes = {
  currentProject: PropTypes.object
};

class InviteLink extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowAddInviteLink: false,
      inviteLinks: []
    };
    this.options = ShareUtils.getOption(this.props);
  }

  componentDidMount() {
    const { workspace_id, name } = this.props.currentProject;
    seaQAAPI.getProjectInviteLink(workspace_id, name).then(res => {
      let inviteLinks = res.data.dtable_share_links;
      this.setState({
        inviteLinks: inviteLinks,
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      toaster.danger(errMsg);
    });
  }

  onAddInviteLink = () => {
    this.setState({ isShowAddInviteLink: !this.state.isShowAddInviteLink });
  };

  addInviteLink = (inviteLink) => {
    let inviteLinks = this.state.inviteLinks.slice();
    inviteLinks.push(inviteLink);
    this.setState({ inviteLinks: inviteLinks });
  };

  showActionSheet = (inviteItem) => {
    let BUTTONS = [
      (<div className="my-am-action"><i className="dtable-font dtable-icon-copy-link"></i>{gettext('Copy link')}</div>),
      (<div className="my-am-action"><i className="dtable-font dtable-icon-delete"></i>{gettext('Delete link')}</div>),
    ];
    ActionSheet.showActionSheetWithOptions({
      options: BUTTONS,
      maskClosable: true,
      className: 'dtable-antd-mobile-action-sheet'
    }, (buttonIndex) => {
      if (buttonIndex === 0) this.onCopyInviteLink(inviteItem.link);
      if (buttonIndex === 1) this.deleteInviteLink(inviteItem);
    });
  };

  deleteInviteLink = (inviteLink) => {
    seaQAAPI.deleteProjectInviteLink(inviteLink.token).then(() => {
      let { inviteLinks } = this.state;
      inviteLinks = inviteLinks.filter((item) => {
        return item.token !== inviteLink.token;
      });
      this.setState({
        inviteLinks: inviteLinks
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  onCopyInviteLink = (url) => {
    copy(url);
    toaster.success(gettext('Invite link copied'));
  };

  render() {
    const { isShowAddInviteLink, inviteLinks } = this.state;
    return (
      <Fragment>
        <ShareAddedBtn callback={this.onAddInviteLink} addedName={gettext('Add invite link')} />
        {inviteLinks.length > 0 &&
          <List className="mt-4">
            {inviteLinks.map((item) => {
              const url = item.link.slice(0, 10) + '...' + item.link.slice(length - 10);
              let permissionTip = Utils.sharePerms(item.permission);
              return (
                <Item
                  key={item.token}
                  multipleLine
                  extra={
                    <div>
                      <span className="mr-2" style={{ fontSize: '14px' }}>{permissionTip}</span>
                      <IconButton icon="ellipsis" onClick={() => this.showActionSheet(item)} />
                    </div>
                  }
                >
                  {url}
                  <Brief>{gettext('Expire date')}: {item.expire_date ? dayjs(item.expire_date).format('YYYY-MM-DD HH:mm') : '-'}</Brief>
                </Item>
              );
            })}
          </List>
        }
        {isShowAddInviteLink &&
          <AddInviteLink
            toggle={this.onAddInviteLink}
            addInviteLink={this.addInviteLink}
            currentProject={this.props.currentProject}
            options={this.options}
          />
        }
      </Fragment>
    );
  }
}

InviteLink.propTypes = propTypes;

export default InviteLink;
