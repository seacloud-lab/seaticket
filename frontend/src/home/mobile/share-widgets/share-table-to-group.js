import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster, Loading } from '../../../components';
import ShareItem from './share-item';
import { Utils } from '../../../utils/utils';
import ShareAddedBtn from './share-add-btn';
import ShareUtils from './share-utils';
import { seaQAAPI } from '../../../api/web-api';
import AddShareGroup from './add-share-group';
import { gettext } from '../../../constants';

const propTypes = {
  currentProject: PropTypes.object.isRequired,
  customSharePermissions: PropTypes.array,
};

class ShareProjectToGroup extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowAddShareGroup: false,
      groupShares: [],
      isLoading: true
    };
    this.options = ShareUtils.getOption(this.props);
  }

  componentDidMount() {
    const { workspace_id, name } = this.props.currentProject;
    seaQAAPI.listProjectGroupShares(workspace_id, name).then(res => {
      this.setState({ groupShares: res.data.dtable_group_share_list, isLoading: false });
    }).catch(error => {
      this.setState({ isLoading: false });
      this.handleErrorTip(error);
    });
  }

  addProjectShare = (selectedOptions, permission) => {
    const { workspace_id, name } = this.props.currentProject;
    const { groupShares } = this.state;
    if (!selectedOptions || selectedOptions.length === 0) return;
    const groupIDs = selectedOptions.map(item => item.value);
    seaQAAPI.addProjectGroupShare(workspace_id, name, groupIDs, permission).then((res) => {
      const { success: successGroupShares, failed: failedGroupShares } = res.data;
      if (successGroupShares.length > 0) {
        groupShares.push(...successGroupShares);
        this.setState({ groupShares });
      }
      if (failedGroupShares.length > 0) {
        failedGroupShares.forEach((share) => {
          toaster.danger(share.error_msg);
        });
      }
    }).catch((error) => {
      this.handleErrorTip(error);
    });
  };

  updateProjectShare = (groupShare, permission) => {
    const { workspace_id, name } = this.props.currentProject;
    let groupID = groupShare.group_id;
    seaQAAPI.updateProjectGroupShare(workspace_id, name, groupID, permission).then(() => {
      let groupShares = this.state.groupShares.slice();
      groupShares = groupShares.map((item) => {
        if (item.group_id === groupID) {
          item.permission = permission;
        }
        return item;
      });
      this.setState({ groupShares: groupShares });

    }).catch((error) => {
      this.handleErrorTip(error);
    });
  };

  deleteProjectShare = (groupShare) => {
    const { workspace_id, name } = this.props.currentProject;
    let groupID = groupShare.group_id;
    seaQAAPI.deleteProjectGroupShare(workspace_id, name, groupID).then(() => {

      let groupShares = this.state.groupShares.slice();
      groupShares = groupShares.filter((item) => {return item.group_id !== groupID;});
      this.setState({ groupShares: groupShares });

    }).catch((error) => {
      this.handleErrorTip(error);
    });
  };

  handleErrorTip = (error) => {
    let errMsg = Utils.getErrorMsg(error, true);
    if (!error.response || error.response.status !== 403) {
      toaster.danger(errMsg);
    }
  };

  onAddShareGroup = () => {
    this.setState({ isShowAddShareGroup: !this.state.isShowAddShareGroup });
  };

  render() {
    const { isShowAddShareGroup, groupShares, isLoading } = this.state;
    return (
      <Fragment>
        <ShareAddedBtn callback={this.onAddShareGroup} addedName={gettext('Add groups')} />
        {isLoading && <div className="mt-4"><Loading /></div>}
        {groupShares.length > 0 &&
          <div className="share-list">
            {groupShares.map((groupItem) => {
              return (
                <ShareItem
                  key={groupItem.group_id}
                  item={groupItem}
                  deleteProjectShare={this.deleteProjectShare}
                  updateProjectShare={this.updateProjectShare}
                  shareName={groupItem.group_name}
                  options={this.options}
                />
              );
            })}
          </div>
        }
        {isShowAddShareGroup &&
          <AddShareGroup
            toggle={this.onAddShareGroup}
            addProjectShare={this.addProjectShare}
            options={this.options}
            customSharePermissions={this.props.customSharePermissions}
          />
        }
      </Fragment>
    );
  }
}

ShareProjectToGroup.propTypes = propTypes;

export default ShareProjectToGroup;
