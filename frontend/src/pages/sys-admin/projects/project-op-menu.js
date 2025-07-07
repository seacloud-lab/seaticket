import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownMenu, DropdownToggle, DropdownItem } from 'reactstrap';
import { gettext } from '../../../constants';
import { Utils } from '../../../utils/utils';

class ProjectOpMenu extends React.Component {

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
      case 'Delete':
        return gettext('Delete');
      case 'External links':
        return gettext('External links');
      case 'Unset password':
        return gettext('Unset password');
      case 'API tokens':
        return gettext('API tokens');
      case 'Export':
        return gettext('Export');
      case 'Copy':
        return gettext('Copy');
      case 'Share':
        return gettext('Share');
      case 'Repair':
        return gettext('Repair');
      default:
        return '';
    }
  };

  render() {
    const operations = this.props.operations || ['External links', 'Delete'];

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
        <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu mr-2">
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

ProjectOpMenu.propTypes = {
  operations: PropTypes.array,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  onMenuItemClick: PropTypes.func.isRequired,
};

export default ProjectOpMenu;
