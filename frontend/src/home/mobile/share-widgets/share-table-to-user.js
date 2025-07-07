import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster, Loading } from '../../../components';
import ShareItem from './share-item';
import { Utils } from '../../../utils/utils';
import ShareAddedBtn from './share-add-btn';
import ShareUtils from './share-utils';
import { seaQAAPI } from '../../../api/web-api';
import AddShareUser from './add-share-user';
import { gettext } from '../../../constants';

const propTypes = {
  customSharePermissions: PropTypes.array,
  currentProject: PropTypes.object.isRequired,
};

class ShareTableToUser extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      userList: [],
      isShowAddShareUser: false,
      isLoading: true,
    };
    this.options = ShareUtils.getOption(this.props);
  }

  componentDidMount() {
    const { workspace_id, name } = this.props.currentProject;
    seaQAAPI.listProjectShares(workspace_id, name).then((res) => {
      this.setState({ userList: res.data.user_list, isLoading: false });
    }).catch(error => {
      this.setState({ isLoading: false });
      this.handleErrorTip(error);
    });
  }

  onAddShareUser = () => {
    this.setState({ isShowAddShareUser: !this.state.isShowAddShareUser });
  };

  addProjectShare = (selectedOptions, permission) => {
    const { userList } = this.state;
    const { workspace_id, name: tableName } = this.props.currentProject;
    if (!selectedOptions || selectedOptions.length === 0) return;
    for (let i = 0; i < selectedOptions.length; i++) {
      const name = selectedOptions[i].name;
      const email = selectedOptions[i].email;
      const avatar_url = selectedOptions[i].avatar_url;
      seaQAAPI.addProjectShare(workspace_id, tableName, email, permission).then((res) => {
        let userInfo = {
          name,
          email,
          permission,
          avatar_url
        };
        userList.push(userInfo);
        this.setState({ userList });
      }).catch(error => {
        this.handleErrorTip(error);
      });
    }
  };

  updateProjectShare = (userItem, permission) => {
    const { workspace_id, name } = this.props.currentProject;
    const email = userItem.email;
    seaQAAPI.updateProjectShare(workspace_id, name, email, permission).then((res) => {
      let userList = this.state.userList.map(userInfo => {
        if (userInfo.email === email) {
          userInfo.permission = permission;
        }
        return userInfo;
      });
      this.setState({ userList: userList });
    }).catch(error => {
      this.handleErrorTip(error);
    });
  };

  deleteProjectShare = (userItem) => {
    const { workspace_id, name } = this.props.currentProject;
    const email = userItem.email;
    seaQAAPI.deleteProjectShare(workspace_id, name, email).then((res) => {
      let userList = this.state.userList.filter(userInfo => {
        return userInfo.email !== email;
      });
      this.setState({ userList: userList });
    }).catch(error => {
      this.handleErrorTip(error);
    });
  };

  handleErrorTip = (error) => {
    let errMsg = Utils.getErrorMsg(error, true);
    if (!error.response || error.response.status !== 403) {
      toaster.danger(errMsg);
    }
  };

  render() {
    const { userList, isShowAddShareUser, isLoading } = this.state;
    return (
      <Fragment>
        <ShareAddedBtn callback={this.onAddShareUser} addedName={gettext('Add users')} />
        {isLoading && <div className="mt-4"><Loading /></div>}
        {userList.length > 0 &&
          <div className="share-list">
            {userList.map((userItem) => {
              return (
                <ShareItem
                  key={userItem.email}
                  item={userItem}
                  deleteProjectShare={this.deleteProjectShare}
                  updateProjectShare={this.updateProjectShare}
                  shareName={userItem.name}
                  isShowImage={true}
                  options={this.options}
                />
              );
            })}
          </div>
        }
        {isShowAddShareUser &&
          <AddShareUser
            toggle={this.onAddShareUser}
            addProjectShare={this.addProjectShare}
            customSharePermissions={this.props.customSharePermissions}
            options={this.options}
          />
        }
      </Fragment>
    );
  }
}

ShareTableToUser.propTypes = propTypes;

export default ShareTableToUser;
