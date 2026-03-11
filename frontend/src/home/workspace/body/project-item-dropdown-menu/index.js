import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';
import { CustomizeDropdownItem, CustomizeDropdownMenu } from '@/components';

import './index.css';

class ProjectItemDropdownMenu extends React.Component {

  onProjectSettingsToggle = () => {
    this.props.onProjectSettingsToggle();
    this.props.onToggle();
  };

  onAPITokenToggle = () => {
    this.props.onAPITokenToggle(this.props.project);
    this.props.onToggle();
  };

  onDeleteProjectToggle = () => {
    this.props.onDeleteProjectToggle();
    this.props.onToggle();
  };

  onChangeProjectGroupToggle = () => {
    this.props.onChangeProjectGroupToggle();
    this.props.onToggle();
  };

  render() {
    return (
      <CustomizeDropdownMenu
        target={this.props.target}
        placement="right-start"
        className="project-item-dropdown-menu"
        modifiers={[
          { name: 'preventOverflow', options: { boundary: document.body } },
          { name: 'offset', options: { offset: [0, 0] } }
        ]}
      >
        <>
          <CustomizeDropdownItem onClick={this.onProjectSettingsToggle}>
            <CustomizeDropdownItem.Icon symbol="rename" />
            <CustomizeDropdownItem.Text>{gettext('Edit name and icon')}</CustomizeDropdownItem.Text>
          </CustomizeDropdownItem>
          <CustomizeDropdownItem onClick={this.onChangeProjectGroupToggle}>
            <CustomizeDropdownItem.Icon symbol="group-stroked" />
            <CustomizeDropdownItem.Text>{gettext('Change group')}</CustomizeDropdownItem.Text>
          </CustomizeDropdownItem>
          <CustomizeDropdownItem onClick={this.onDeleteProjectToggle}>
            <CustomizeDropdownItem.Icon symbol="delete" />
            <CustomizeDropdownItem.Text>{gettext('Delete')}</CustomizeDropdownItem.Text>
          </CustomizeDropdownItem>
          {this.props.onAPITokenToggle &&
            <CustomizeDropdownItem onClick={this.onAPITokenToggle}>
              <CustomizeDropdownItem.Icon symbol="set-up" />
              <CustomizeDropdownItem.Text>{gettext('API token')}</CustomizeDropdownItem.Text>
            </CustomizeDropdownItem>
          }
        </>
      </CustomizeDropdownMenu>
    );
  }
}

ProjectItemDropdownMenu.propTypes = {
  project: PropTypes.object.isRequired,
  target: PropTypes.string.isRequired,
  onToggle: PropTypes.func.isRequired,
  onProjectSettingsToggle: PropTypes.func.isRequired,
  onChangeProjectGroupToggle: PropTypes.func.isRequired,
  onAPITokenToggle: PropTypes.func,
  onDeleteProjectToggle: PropTypes.func.isRequired,
};

export default ProjectItemDropdownMenu;
