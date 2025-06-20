import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import ShareItem from './share-item';
import { Utils } from '../../../../utils/utils';
import ShareAddedBtn from './share-add-btn';
import Loading from '../../../../components/loading';
import DTableShareUtils from './dtable-share-utils';
import { seaQAAPI } from '../../../../api/web-api';
import AddShareGroup from './add-share-group';
import { gettext } from '../../../../constants/config';

const propTypes = {
  currentTable: PropTypes.object.isRequired,
  customSharePermissions: PropTypes.array,
};

class ShareTableToGroup extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowAddShareGroup: false,
      groupShares: [],
      isLoading: true
    };
    this.options = DTableShareUtils.getOption(this.props);
  }

  componentDidMount() {
    const { workspace_id, name } = this.props.currentTable;
    seaQAAPI.listTableGroupShares(workspace_id, name).then(res => {
      this.setState({ groupShares: res.data.dtable_group_share_list, isLoading: false });
    }).catch(error => {
      this.setState({ isLoading: false });
      this.handleErrorTip(error);
    });
  }

  addTableShare = (selectedOptions, permission) => {
    const { workspace_id, name } = this.props.currentTable;
    const { groupShares } = this.state;
    if (!selectedOptions || selectedOptions.length === 0) return;
    const groupIDs = selectedOptions.map(item => item.value);
    seaQAAPI.addTableGroupShare(workspace_id, name, groupIDs, permission).then((res) => {
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

  updateTableShare = (groupShare, permission) => {
    const { workspace_id, name } = this.props.currentTable;
    let groupID = groupShare.group_id;
    seaQAAPI.updateTableGroupShare(workspace_id, name, groupID, permission).then(() => {
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

  deleteTableShare = (groupShare) => {
    const { workspace_id, name } = this.props.currentTable;
    let groupID = groupShare.group_id;
    seaQAAPI.deleteTableGroupShare(workspace_id, name, groupID).then(() => {

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
                  deleteTableShare={this.deleteTableShare}
                  updateTableShare={this.updateTableShare}
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
            addTableShare={this.addTableShare}
            options={this.options}
            customSharePermissions={this.props.customSharePermissions}
          />
        }
      </Fragment>
    );
  }
}

ShareTableToGroup.propTypes = propTypes;

export default ShareTableToGroup;
