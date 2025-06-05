import React from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import dayjs from '../../../../utils/dayjs';
import { gettext, siteRoot } from '../../../../utils/constants';

const propTypes = {
  group: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  showRenameDepartmentDialog: PropTypes.func.isRequired,
  showDeleteDepartDialog: PropTypes.func.isRequired,
};

class GroupItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
      isOpIconShown: false,
      isItemMenuShow: false,
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
      isOpIconShown: false
    });
    this.props.onUnfreezedItem();
  };

  toggleOperationMenu = () => {
    this.setState({
      isItemMenuShow: !this.state.isItemMenuShow
    }, () => {
      if (this.state.isItemMenuShow) {
        this.props.onFreezedItem();
      } else {
        this.setState({ highlight: false });
        this.props.onUnfreezedItem();
      }
    });
  };

  toggleDeleteDialog = () => {
    const { group } = this.props;
    this.props.showDeleteDepartDialog(group);
  };

  toggleRenameDialog = () => {
    const { group } = this.props;
    this.props.showRenameDepartmentDialog(group);
  };

  render() {
    const { group } = this.props;
    const { highlight, isOpIconShown } = this.state;
    const newHref = siteRoot + 'sys/departments/' + group.id + '/';

    return (
      <tr className={highlight ? 'tr-highlight' : ''} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <td><Link to={newHref}>{group.name}</Link></td>
        <td>{dayjs(group.created_at).fromNow()}</td>
        <td className="text-center cursor-pointer">
          {isOpIconShown &&
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
                <DropdownItem onClick={this.toggleRenameDialog}>{gettext('Rename')}</DropdownItem>
                <DropdownItem onClick={this.toggleDeleteDialog}>{gettext('Delete')}</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          }
        </td>
      </tr>
    );
  }
}

GroupItem.propTypes = propTypes;

export default GroupItem;
