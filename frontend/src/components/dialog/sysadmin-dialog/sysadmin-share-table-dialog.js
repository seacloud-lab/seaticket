import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';
import { gettext } from '../../../utils/constants';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import { DIALOG_MAX_HEIGHT } from '../../../utils/utils';
import SysAdminShareTableToUser from './sysadmin-share-table-to-user';
import SysAdminShareTableToGroup from './sysadmin-share-table-to-group';

import '../../../css/share-link-dialog.css';

const propTypes = {
  groupName: PropTypes.string,
  currentTable: PropTypes.object.isRequired,
  shareCancel: PropTypes.func.isRequired,
  srcGroupID: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

class SysAdminShareTableDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      activeTab: 'shareToUser',
      customSharePermissions: [],
    };
  }

  componentDidMount() {
    let dtableUuid = this.props.currentTable.uuid;
    sysAdminServiceApi.sysAdminGetSharePermissions(dtableUuid).then((res) => {
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
              <NavItem aria-selected={activeTab === 'shareToGroup'} aria-controls="shareToGroup">
                <NavLink
                  className={activeTab === 'shareToGroup' ? 'active' : ''}
                  onClick={this.toggle.bind(this, 'shareToGroup')}
                >
                  {gettext('Share to group')}
                </NavLink>
              </NavItem>
            </Fragment>
          </Nav>
        </div>
        <div className="share-dialog-main">
          <TabContent activeTab={this.state.activeTab}>
            <TabPane tabId="shareToUser" id="shareToUser">
              <SysAdminShareTableToUser
                currentTable={this.props.currentTable}
                customSharePermissions={customSharePermissions}
              />
            </TabPane>
            <TabPane tabId="shareToGroup" id="shareToGroup">
              <SysAdminShareTableToGroup
                currentTable={this.props.currentTable}
                customSharePermissions={customSharePermissions}
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

SysAdminShareTableDialog.propTypes = propTypes;

export default SysAdminShareTableDialog;
