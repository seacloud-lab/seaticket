import React from 'react';
import PropTypes from 'prop-types';
import { PopoverBody } from 'reactstrap';
import { gettext } from '@/constants';
import { Icon, CustomizePopover } from '@/components';

import './index.css';

class ProjectItemPopover extends React.Component {

  onEnter = (e) => {
    e.preventDefault();
    this.props.onToggle();
  };

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

  render() {
    const { target } = this.props;
    return (
      <CustomizePopover
        target={target}
        placement="right-start"
        className="project-item-popover"
        hidePopover={this.props.onToggle}
        hidePopoverWithEsc={this.props.onToggle}
        onEnter={this.onEnter}
        hideArrow={true}
        modifiers={[
          { name: 'preventOverflow', options: { boundary: document.body } },
          { name: 'offset', options: { offset: [0, 0] } }
        ]}
      >
        <PopoverBody className="project-item-popover-content">
          <button className="dropdown-item project-item-operation" onClick={this.onProjectSettingsToggle}>
            <Icon symbol="rename" className="project-item-operation-icon" />
            {gettext('Edit name and icon')}
          </button>
          <button className="dropdown-item project-item-operation" onClick={this.onDeleteProjectToggle}>
            <Icon symbol="delete" className="project-item-operation-icon" />
            {gettext('Delete')}
          </button>
          {this.props.onAPITokenToggle &&
            <button className="dropdown-item project-item-operation" onClick={this.onAPITokenToggle}>
              <Icon symbol="settings" className="project-item-operation-icon" />
              {gettext('API Token')}
            </button>
          }
        </PopoverBody>
      </CustomizePopover>
    );
  }
}

ProjectItemPopover.propTypes = {
  target: PropTypes.string.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default ProjectItemPopover;
