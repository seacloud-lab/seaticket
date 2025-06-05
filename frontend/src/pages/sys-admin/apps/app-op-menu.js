import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownMenu, DropdownToggle, DropdownItem } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';

class AppOpMenu extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemMenuShow: false
    };
  }

  onMenuItemClick = (e) => {
    let operation = Utils.getEventData(e, 'op');
    this.props.onMenuItemClick(operation);
  };

  onDropdownToggleClick = (e) => {
    this.toggleOperationMenu(e);
  };

  toggleOperationMenu = () => {
    this.setState({ isItemMenuShow: !this.state.isItemMenuShow },
      () => {
        if (this.state.isItemMenuShow) {
          this.props.onFreezedItem();
        } else {
          this.props.onUnfreezedItem();
        }
      }
    );
  };

  translateOperations = (item) => {
    switch (item) {
      case 'Suspend':
        return gettext('Suspend');
      case 'Resume':
        return gettext('Resume');
      case 'Delete':
        return gettext('Delete');
      case 'Enable open access':
        return gettext('Enable open access');
      case 'Disable open access':
        return gettext('Disable open access');
      case 'Copy app URL to clipboard':
        return gettext('Copy app URL to clipboard');
      case 'Set current user as admin':
        return gettext('Set current user as admin');
      default:
        return '';
    }
  };

  render() {
    const operations = this.props.operations;

    return (
      <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
        <DropdownToggle
          tag="a"
          role="button"
          className="attr-action-icon dtable-font dtable-icon-more-vertical"
          title={gettext('More operations')}
          aria-label={gettext('More operations')}
          data-toggle="dropdown"
          aria-expanded={this.state.isItemMenuShow}
        />
        <DropdownMenu className="dtable-dropdown-menu dropdown-menu mr-2">
          {operations.map((item, index ) => {
            return (
              <DropdownItem key={index} data-op={item} onClick={this.onMenuItemClick}>
                {this.translateOperations(item)}
              </DropdownItem>
            );
          })}
        </DropdownMenu>
      </Dropdown>
    );
  }
}

AppOpMenu.propTypes = {
  operations: PropTypes.array,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  onMenuItemClick: PropTypes.func.isRequired,
};

export default AppOpMenu;
