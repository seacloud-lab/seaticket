import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import dayjs from '../../utils/dayjs';
import { Utils } from '../../utils/utils';
import OpMenu from './op-menu';
import RenameFileDialog from '../dialog/sysadmin-dialog/rename-file-dialog';
class DirItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isRenameDialogShow: false,
      isOpIconShown: false
    };
  }

  onMenuItemClick = (operation) => {
    if (operation === 'Rename') {
      this.toggleRenameDialog();
    }
  };

  toggleRenameDialog = () => {
    this.setState({ isRenameDialogShow: !this.state.isRenameDialogShow });
  };

  handleMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOpIconShown: true });
    }
  };

  handleMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOpIconShown: false });
    }
  };

  setNewName = (newName) => {
    this.props.setNewName(this.props.dirent, newName);
  };

  openFolder = () => {
    this.props.openFolder(this.props.dirent);
  };

  render() {
    let dirent = this.props.dirent;
    let iconUrl = Utils.getDirentIcon(dirent);


    return (
      <Fragment>
        <tr onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td className="text-center"><img src={iconUrl} width="24" alt='' /></td>
          <td>
            {dirent.is_file ?
              dirent.name :
              <Link to="#" onClick={this.openFolder}>{dirent.name}</Link>
            }
          </td>
          <td>{dirent.is_file ? Utils.bytesToSize(dirent.size) : ''}</td>
          <td>{dayjs(dirent.mtime).fromNow()}</td>
          <td>
            {this.state.isOpIconShown && dirent.is_file &&
              <OpMenu
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.props.onUnfreezedItem}
                onMenuItemClick={this.onMenuItemClick}
                operations={this.props.operations}
              />
            }
          </td>
        </tr>
        {this.state.isRenameDialogShow &&
          <RenameFileDialog
            toggle={this.toggleRenameDialog}
            setNewName={this.setNewName}
            oldName={this.props.dirent.name}
          />
        }
      </Fragment>
    );
  }

}

const propTypes = {
  dirent: PropTypes.object.isRequired,
  openFolder: PropTypes.func.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  setNewName: PropTypes.func.isRequired,
  operations: PropTypes.array,
};
DirItem.propTypes = propTypes;
export default DirItem;
