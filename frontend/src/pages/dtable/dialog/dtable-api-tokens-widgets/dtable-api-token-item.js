import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import DTableOpMenu from '../../../sys-admin/dtables/dtable-op-menu';
import ModalPortal from '../../../../components/modal-portal';
import DeleteTokenDialog from '../delete-token-dialog';

const OPERATIONS = ['Delete'];

class DTableApiTokenItem extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isDeleteDialogOpen: false,
    };
  }

  handleMouseOver = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: true,
        highlight: true
      });
    }
  };

  handleMouseOut = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: false,
        highlight: false
      });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false,
      isOpIconShown: false
    });
    this.props.onUnfreezedItem();
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Delete':
        this.toggleDeleteDialog();
        break;
      default:
        break;
    }
  };

  onDeleteAPIToken = () => {
    this.props.deleteAPIToken(this.props.item);
    this.toggleDeleteDialog();
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  render() {
    const item = this.props.item;

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td className="ellipsis pl-2">{item.app_name}</td>
          <td className="ellipsis">{item.api_token}</td>
          <td className="ellipsis">{item.generated_by}</td>
          <td>
            {this.state.isOpIconShown &&
              <DTableOpMenu
                operations={OPERATIONS}
                onMenuItemClick={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
          </td>
          {this.state.isDeleteDialogOpen &&
            <ModalPortal>
              <DeleteTokenDialog
                currentToken={item}
                deleteCancel={this.toggleDeleteDialog}
                handleSubmit={this.onDeleteAPIToken}
              />
            </ModalPortal>
          }
        </tr>
      </Fragment>
    );
  }
}

DTableApiTokenItem.propTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteAPIToken: PropTypes.func.isRequired
};

export default DTableApiTokenItem;
