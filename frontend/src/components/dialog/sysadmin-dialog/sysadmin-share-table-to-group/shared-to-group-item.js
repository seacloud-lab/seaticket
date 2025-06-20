import React from 'react';
import PropTypes from 'prop-types';
import DtableSharePermissionEditor from '../../../../components/select-editor/dtable-share-permission-editor';
import { gettext } from '../../../../constants';

class SharedToGroupItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isOperationShow: false,
    };
  }

  onMouseEnter = () => {
    this.setState({ isOperationShow: true });
  };

  onMouseLeave = () => {
    this.setState({ isOperationShow: false });
  };

  updateTableShare = (permission) => {
    if (permission === 'addCustomSharePermission') return;
    if (permission !== this.props.groupShare.permission) {
      this.props.updateTableShare(this.props.groupShare.group_id, permission);
    }
  };

  deleteTableShare = () => {
    this.props.deleteTableShare(this.props.groupShare.group_id);
  };

  render() {
    const { group_name, permission } = this.props.groupShare;
    return (
      <tr onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <td>{group_name}</td>
        <td>
          <DtableSharePermissionEditor
            isTextMode={true}
            isEditIconShow={this.state.isOperationShow}
            currentPermission={permission}
            customSharePermissions={this.props.customSharePermissions}
            onPermissionChanged={this.updateTableShare}
            onAddCustomSharePermission={this.props.onAddCustomSharePermission}
          />
        </td>
        <td>
          <span
            className={`dtable-font dtable-icon-x action-icon ${this.state.isOperationShow ? '' : 'hide'}`}
            onClick={this.deleteTableShare}
            title={gettext('Delete')}
            aria-label={gettext('Delete')}
          />
        </td>
      </tr>
    );
  }
}

SharedToGroupItem.propTypes = {
  groupShare: PropTypes.object.isRequired,
  updateTableShare: PropTypes.func.isRequired,
  deleteTableShare: PropTypes.func.isRequired,
  customSharePermissions: PropTypes.array,
  onAddCustomSharePermission: PropTypes.func,
};

export default SharedToGroupItem;
