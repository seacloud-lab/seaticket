import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { DTableModalHeader } from 'dtable-ui-component';
import { Modal, ModalBody, Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap';
import { gettext, cloudMode, isOrgContext, canGenerateExternalLink, canUseAdvancedPerms } from '../../../utils/constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { DIALOG_MAX_HEIGHT } from '../../../utils/utils';
import ShareTableToUser from './share-table-to-user';
import ShareTableToGroup from './share-table-to-group';
import GenerateDTableInviteLink from './generate-dtable-invite-link';
import GenerateDTableExternalLink from './generate-dtable-external-link';
import SharePermissions from './share-permissions';

import '../../../css/share-link-dialog.css';

const propTypes = {
  groupName: PropTypes.string,
  currentTable: PropTypes.object.isRequired,
  shareCancel: PropTypes.func.isRequired,
  onAddGroupSharedTable: PropTypes.func.isRequired,
  onLeaveGroupSharedTable: PropTypes.func.isRequired,
  srcGroupID: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

class ShareTableDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      activeTab: 'shareToUser',
      customSharePermissions: [],
    };
  }

  componentDidMount() {
    const { workspace_id, name } = this.props.currentTable;
    dtableWebAPI.getSharePermissions(workspace_id, name).then((res) => {
      const customSharePermissions = res.data.permission_list;
      this.setState({ customSharePermissions });
    });
    this.initStyle();
  }

  initStyle = () => {
    setTimeout(() => {
      const shareDialogDom = this.innerRef.firstChild;
      const contentDom = shareDialogDom.firstChild;
      contentDom.style.maxHeight = (DIALOG_MAX_HEIGHT) + 'px';
    }, 1);
  };

  toggle = (tab) => {
    if (this.state.activeTab !== tab) {
      this.setState({ activeTab: tab });
    }
  };

  onAddGroupSharedTable = (groupID, table) => {
    this.props.onAddGroupSharedTable(groupID, table);
  };

  onAddSharePermission = (permission) => {
    const { workspace_id, name } = this.props.currentTable;
    let { customSharePermissions } = this.state;
    dtableWebAPI.addSharePermission(workspace_id, name, permission).then((res) => {
      const newPermission = res.data.permission;
      this.setState({ customSharePermissions: [...customSharePermissions, newPermission] });
    });
  };

  onUpdateSharePermission = (permission) => {
    const { workspace_id, name } = this.props.currentTable;
    const permissionId = permission.id;
    let { customSharePermissions } = this.state;
    let updatedCustomSharePermissions = [...customSharePermissions];
    let updatedPermissionIndex = updatedCustomSharePermissions.findIndex((permission) => permission.id === permissionId);
    if (updatedPermissionIndex < 0) return;
    dtableWebAPI.updateSharePermission(workspace_id, name, permissionId, permission).then((res) => {
      const newPermission = res.data.permission;
      updatedCustomSharePermissions[updatedPermissionIndex] = newPermission;
      this.setState({ customSharePermissions: updatedCustomSharePermissions });
    });
  };

  onDeleteSharePermission = (index) => {
    const { workspace_id, name } = this.props.currentTable;
    let { customSharePermissions } = this.state;
    let updatedCustomSharePermissions = [...customSharePermissions];
    let deletedPermission = updatedCustomSharePermissions[index];
    if (!deletedPermission) return;
    dtableWebAPI.deleteSharePermission(workspace_id, name, deletedPermission.id).then(() => {
      updatedCustomSharePermissions.splice(index, 1);
      this.setState({ customSharePermissions: updatedCustomSharePermissions });
    });
  };

  onAddCustomSharePermission = () => {
    this.setState({ activeTab: 'customSharingPermissions' });
  };

  renderContent = () => {
    let { activeTab, customSharePermissions } = this.state;

    return (
      <Fragment>
        <div className="share-dialog-side">
          <Nav pills vertical>
            <Fragment>
              <NavItem aria-selected={activeTab === 'shareToUser'} aria-controls="shareToUser">
                <NavLink
                  className={activeTab === 'shareToUser' ? 'active' : ''}
                  onClick={this.toggle.bind(this, 'shareToUser')}
                >
                  {gettext('Share to user')}
                </NavLink>
              </NavItem>
              {(!cloudMode || isOrgContext) && (
                <NavItem aria-selected={activeTab === 'shareToGroup'} aria-controls="shareToGroup">
                  <NavLink
                    className={activeTab === 'shareToGroup' ? 'active' : ''}
                    onClick={this.toggle.bind(this, 'shareToGroup')}
                  >
                    {gettext('Share to group')}
                  </NavLink>
                </NavItem>
              )}
              <NavItem aria-selected={activeTab === 'inviteLink'} aria-controls="inviteLink">
                <NavLink
                  className={activeTab === 'inviteLink' ? 'active' : ''}
                  onClick={this.toggle.bind(this, 'inviteLink')}
                >
                  {gettext('Invite link')}
                </NavLink>
              </NavItem>
              {canGenerateExternalLink && (
                <NavItem aria-selected={activeTab === 'externalLink'} aria-controls="externalLink">
                  <NavLink
                    className={activeTab === 'externalLink' ? 'active' : ''}
                    onClick={this.toggle.bind(this, 'externalLink')}
                  >
                    {gettext('External link')}
                  </NavLink>
                </NavItem>
              )}
              {canUseAdvancedPerms && (
                <NavItem aria-selected={activeTab === 'customSharingPermissions'} aria-controls="customSharingPermissions">
                  <NavLink
                    className={activeTab === 'customSharingPermissions' ? 'active' : ''}
                    onClick={this.toggle.bind(this, 'customSharingPermissions')}
                  >
                    {gettext('Custom sharing permissions')}
                  </NavLink>
                </NavItem>
              )}
            </Fragment>
          </Nav>
        </div>
        <div className="share-dialog-main">
          <TabContent activeTab={this.state.activeTab}>
            <TabPane tabId="shareToUser" id="shareToUser">
              <ShareTableToUser
                currentTable={this.props.currentTable}
                customSharePermissions={customSharePermissions}
                onAddCustomSharePermission={this.onAddCustomSharePermission}
              />
            </TabPane>
            {(!cloudMode || isOrgContext) &&
              <TabPane tabId="shareToGroup" id="shareToGroup">
                <ShareTableToGroup
                  currentTable={this.props.currentTable}
                  customSharePermissions={customSharePermissions}
                  onAddGroupSharedTable={this.onAddGroupSharedTable}
                  onLeaveGroupSharedTable={this.props.onLeaveGroupSharedTable}
                  onAddCustomSharePermission={this.onAddCustomSharePermission}
                  srcGroupID={this.props.srcGroupID}
                  groupName={this.props.groupName}
                />
              </TabPane>
            }
            <TabPane tabId="inviteLink" id="inviteLink">
              <GenerateDTableInviteLink
                workspaceID={this.props.currentTable.workspace_id}
                name={this.props.currentTable.name}
                closeShareDialog={this.props.shareCancel}
              />
            </TabPane>
            {canGenerateExternalLink && (
              <TabPane tabId="externalLink" id="externalLink">
                <GenerateDTableExternalLink
                  workspaceID={this.props.currentTable.workspace_id}
                  name={this.props.currentTable.name}
                />
              </TabPane>
            )}
            <TabPane tabId="customSharingPermissions" id="customSharingPermissions">
              <SharePermissions
                customSharePermissions={customSharePermissions}
                workspaceID={this.props.currentTable.workspace_id}
                name={this.props.currentTable.name}
                onAddSharePermission={this.onAddSharePermission}
                onUpdateSharePermission={this.onUpdateSharePermission}
                onDeleteSharePermission={this.onDeleteSharePermission}
              />
            </TabPane>
          </TabContent>
        </div>
      </Fragment>
    );
  };

  render() {
    let currentTable = this.props.currentTable;
    let name = currentTable.name;
    return (
      <Modal isOpen={true} toggle={this.props.shareCancel} style={{ maxWidth: '850px' }} className="share-dialog" innerRef={ref => this.innerRef = ref}>
        <DTableModalHeader toggle={this.props.shareCancel}>
          <span className="mr-1">{gettext('Share')}</span>
          <span className="op-target" title={name}>{name}</span>
        </DTableModalHeader>
        <ModalBody className="share-dialog-content">
          {this.renderContent()}
        </ModalBody>
      </Modal>
    );
  }
}

ShareTableDialog.propTypes = propTypes;

export default ShareTableDialog;
