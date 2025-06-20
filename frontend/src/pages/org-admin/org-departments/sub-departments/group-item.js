import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import dayjs from '../../../../utils/dayjs';
import { gettext, siteRoot } from '../../../../constants';

const propTypes = {
  group: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  showDeleteDepartDialog: PropTypes.func.isRequired,
  showRenameDepartmentDialog: PropTypes.func.isRequired,
};

class GroupItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
      isItemFreezed: false,
      isItemMenuShow: false,
      isOpIconShown: false,
    };
  }

  onMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOpIconShown: true, highlight: true });
    }
  };

  onMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOpIconShown: false, highlight: false });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false,
      isOpIconShown: false,
    });
    this.props.onUnfreezedItem();
  };

  toggleDeleteDialog = () => {
    this.props.showDeleteDepartDialog(this.props.group);
  };

  toggleOperationMenu = () => {
    this.setState({ isItemMenuShow: !this.state.isItemMenuShow }, () => {
      if (this.state.isItemMenuShow) {
        this.props.onFreezedItem();
      } else {
        this.setState({ highlight: false });
        this.props.onUnfreezedItem();
      }
    });
  };

  toggleRenameDialog = () => {
    this.props.showRenameDepartmentDialog(this.props.group);
  };

  render() {
    const { group } = this.props;
    const { highlight, isOpIconShown, isItemMenuShow } = this.state;
    const newHref = `${siteRoot}org/departmentadmin/groups/${group.id}/`;

    return (
      <tr
        className={highlight ? 'tr-highlight' : ''}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        <td>
          <Link to={newHref}>{group.name}</Link>
        </td>
        <td>{dayjs(group.created_at).fromNow()}</td>
        <td className="text-center cursor-pointer">
          {isOpIconShown && (
            <Dropdown isOpen={isItemMenuShow} toggle={this.toggleOperationMenu}>
              <DropdownToggle
                tag="i"
                role="button"
                className="attr-action-icon dtable-font dtable-icon-more-vertical"
                title={gettext('More operations')}
                aria-label={gettext('More operations')}
                data-toggle="dropdown"
                aria-expanded={isItemMenuShow}
              />
              <DropdownMenu className="dtable-dropdown-menu dropdown-menu mr-2">
                <DropdownItem onClick={this.toggleRenameDialog}>
                  {gettext('Rename')}
                </DropdownItem>
                <DropdownItem onClick={this.toggleDeleteDialog}>
                  {gettext('Delete')}
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          )}
        </td>
      </tr>
    );
  }
}

GroupItem.propTypes = propTypes;

export default GroupItem;
