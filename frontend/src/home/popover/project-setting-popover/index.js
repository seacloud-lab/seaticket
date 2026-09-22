import React from 'react';
import { Button, PopoverBody } from 'reactstrap';
import PropTypes from 'prop-types';
import CustomizePopover from '@/components/customize-popover';
import { gettext } from '@/constants';
import ProjectSettingContent from '../../components/project-setting-content';
import SelectProjectIconContent from '../../components/select-project-icon-content';

import './index.css';

class ProjectSettingPopover extends React.Component {

  static propTypes = {
    placement: PropTypes.string,
    className: PropTypes.string,
    target: PropTypes.string.isRequired,
    onCancel: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    name: PropTypes.string.isRequired,
    bgColor: PropTypes.string,
    icon: PropTypes.string,
    onColorChange: PropTypes.func.isRequired,
    onIconChange: PropTypes.func.isRequired,
    onNameChange: PropTypes.func.isRequired,
  };

  state = {
    isSelectIconViewOpen: false,
  };

  openSelectIconView = () => {
    this.setState({ isSelectIconViewOpen: true });
  };

  closeSelectIconView = () => {
    this.setState({ isSelectIconViewOpen: false });
  };

  onSelectIcon = (icon) => {
    this.props.onIconChange(icon);
    this.closeSelectIconView();
  };

  onEnter = (event) => {
    event.preventDefault();
    this.props.onSubmit();
  };

  onFooterButtonKeyDown = (event) => {
    event.stopPropagation();
  };

  render() {
    const { isSelectIconViewOpen } = this.state;
    return (
      <CustomizePopover
        placement={this.props.placement || 'right-start'}
        target={this.props.target}
        hidePopover={this.props.onSubmit}
        hidePopoverWithEsc={isSelectIconViewOpen ? this.closeSelectIconView : this.props.onCancel}
        onEnter={isSelectIconViewOpen ? undefined : this.onEnter}
        hideArrow={true}
        className={`project-setting-popover ${this.props.className || ''}`}
        modifiers={this.props.modifiers}
      >
        {isSelectIconViewOpen ? (
          <PopoverBody className="p-4">
            <SelectProjectIconContent
              currentIcon={this.props.icon}
              bgColor={this.props.bgColor}
              onPrevious={this.closeSelectIconView}
              onSubmit={this.onSelectIcon}
            />
          </PopoverBody>
        ) : (
          <>
            <PopoverBody className="p-4">
              <ProjectSettingContent
                name={this.props.name}
                bgColor={this.props.bgColor}
                icon={this.props.icon}
                onColorChange={this.props.onColorChange}
                onIconChange={this.props.onIconChange}
                onNameChange={this.props.onNameChange}
                onViewAll={this.openSelectIconView}
                nameInputId={`${this.props.target}-name`}
              />
            </PopoverBody>
            <div className="project-setting-popover-footer">
              <Button color="secondary" onClick={this.props.onCancel} onKeyDown={this.onFooterButtonKeyDown} size="sm">
                {gettext('Cancel')}
              </Button>
              <Button color="primary" onClick={this.props.onSubmit} onKeyDown={this.onFooterButtonKeyDown} size="sm">
                {gettext('Submit')}
              </Button>
            </div>
          </>
        )}
      </CustomizePopover>
    );
  }
}

export default ProjectSettingPopover;
