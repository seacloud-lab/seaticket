import React from 'react';
import { PopoverBody } from 'reactstrap';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { PROJECT_ICON_LIST, PROJECT_ICON_COLORS, gettext } from '../../../constants';
import CustomizePopover from '../../../components/customize-popover';
import { Icon } from '../../../components';

import './index.css';

class ProjectSettingPopover extends React.Component {

  static propTypes = {
    placement: PropTypes.string,
    className: PropTypes.string,
    target: PropTypes.string.isRequired,
    onToggle: PropTypes.func.isRequired,
    name: PropTypes.string.isRequired,
    bgColor: PropTypes.string,
    icon: PropTypes.string,
    onColorChange: PropTypes.func.isRequired,
    onIconChange: PropTypes.func.isRequired,
    onNameChange: PropTypes.func.isRequired,
  };

  onChangeName = (e) => {
    this.props.onNameChange(e.target.value);
  };

  onColorChange = (bgColor) => {
    if (bgColor === this.props.bgColor) return;
    this.props.onColorChange(bgColor);
  };

  onIconChange = (icon) => {
    if (icon === this.props.icon) return;
    this.props.onIconChange(icon);
  };

  onEnter = (e) => {
    e.preventDefault();
    this.props.onToggle();
  };

  renderName = () => {
    return (
      <div className="project-icon-settings-name">
        <input
          type="text"
          className="form-control project-icon-settings-name-input"
          value={this.props.name}
          onChange={this.onChangeName}
          autoFocus={true}
          aria-label={gettext('Enter project name')}
          aria-describedby={gettext('Enter a description of the project name')}
        />
      </div>
    );
  };

  renderColorSettings = () => {
    let { bgColor } = this.props;
    bgColor = bgColor || PROJECT_ICON_COLORS[0];
    return (
      <div className="row sea-qa-color-content">
        {PROJECT_ICON_COLORS.map((color, index) => {
          return (
            <div
              key={index}
              className="sea-qa-color-item"
              onClick={() => this.onColorChange(color)}
              role="button"
            >
              <span className="colorinput">
                <span
                  className="colorinput-color"
                  style={{ backgroundColor: color }}
                  title={`${gettext('Color')} ${color}`}
                  aria-label={`${gettext('Color')} ${color}`}
                  aria-selected={color === bgColor}
                >
                  {color === bgColor && (<Icon symbol="check-mark" className="project-icon-color-check" />)}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  renderIconSettings = () => {
    let { icon, bgColor } = this.props;
    bgColor = bgColor || PROJECT_ICON_COLORS[0];
    icon = icon || PROJECT_ICON_LIST[0];
    return (
      <div className="row project-icon-content">
        {PROJECT_ICON_LIST.map((iconItem, index) => {
          let isSelected = iconItem === icon;
          return (
            <div
              key={index}
              className="project-icon-item"
              onClick={() => this.onIconChange(iconItem)}
              role="button"
              style={{ backgroundColor: isSelected ? bgColor : '' }}
              title={`${gettext('Icon')} ${iconItem}`}
              aria-label={`${gettext('Icon')} ${iconItem}`}
            >
              <span className="colorinput project-icon-input" aria-selected={isSelected}>
                <i aria-hidden="true" className={classnames('project-icon project-icon-style', { [iconItem]: iconItem, 'icon-color-white': isSelected })}></i>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  render() {
    return (
      <CustomizePopover
        placement={this.props.placement || 'right-start'}
        target={this.props.target}
        hidePopover={this.props.onToggle}
        hidePopoverWithEsc={this.props.onToggle}
        onEnter={this.onEnter}
        hideArrow={true}
        className={`project-icon-settings-popover ${this.props.className || ''}`}
        modifiers={this.props.modifiers}
      >
        <PopoverBody className="project-icon-settings-content">
          {this.renderName()}
          {this.renderColorSettings()}
          {this.renderIconSettings()}
        </PopoverBody>
      </CustomizePopover>
    );
  }
}

export default ProjectSettingPopover;
