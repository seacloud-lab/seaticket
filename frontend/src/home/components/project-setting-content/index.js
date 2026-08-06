import React from 'react';
import PropTypes from 'prop-types';
import { Icon, IconButton } from '@/components';
import { DEFAULT_PROJECT_ICON, PROJECT_ICON_ALL_LIST, PROJECT_ICON_LIST, PROJECT_ICON_COLORS, gettext } from '@/constants';
import { parseColorToRGB } from '@/utils/color-utils';

import './index.css';

class ProjectSettingContent extends React.Component {

  static propTypes = {
    name: PropTypes.string.isRequired,
    bgColor: PropTypes.string,
    icon: PropTypes.string,
    onColorChange: PropTypes.func.isRequired,
    onIconChange: PropTypes.func.isRequired,
    onNameChange: PropTypes.func.isRequired,
    onNameKeyDown: PropTypes.func,
    onViewAll: PropTypes.func.isRequired,
    nameInputId: PropTypes.string,
  };

  componentDidUpdate(prevProps) {
    if (prevProps.icon === this.props.icon) return;

    const pinnedIcon = this.getPinnedIcon(this.props.icon);
    if (pinnedIcon && pinnedIcon !== this.state.pinnedIcon) {
      this.setState({ pinnedIcon });
    }
  }

  getPinnedIcon = (icon) => {
    if (!PROJECT_ICON_ALL_LIST.includes(icon) || PROJECT_ICON_LIST.includes(icon)) return '';
    return icon;
  };

  state = {
    pinnedIcon: this.getPinnedIcon(this.props.icon),
  };

  onChangeName = (event) => {
    this.props.onNameChange(event.target.value);
  };

  onColorChange = (bgColor) => {
    if (bgColor === this.props.bgColor) return;
    this.props.onColorChange(bgColor);
  };

  onIconChange = (icon) => {
    if (icon === this.props.icon) return;
    this.props.onIconChange(icon);
  };

  onViewAll = (event) => {
    event && event.stopPropagation();
    this.props.onViewAll();
  };

  onViewAllKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onViewAll(event);
    }
  };

  renderName = () => {
    const { nameInputId = 'project-setting-name' } = this.props;
    return (
      <div className="project-setting-content-name">
        <label className="form-label project-setting-content-label" htmlFor={nameInputId}>{gettext('Name')}</label>
        <input
          type="text"
          id={nameInputId}
          className="form-control project-setting-content-name-input"
          value={this.props.name}
          onChange={this.onChangeName}
          onKeyDown={this.props.onNameKeyDown}
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
      <div className="project-setting-content-color-section">
        <div className="form-label project-setting-content-label">{gettext('Color')}</div>
        <div className="project-setting-content-colors">
          {PROJECT_ICON_COLORS.map((color) => {
            return (
              <div
                key={color}
                className="project-setting-content-color-item"
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
                    {color === bgColor && (<Icon symbol="check-mark" className="project-setting-content-color-check" />)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  renderIconSettings = () => {
    let { icon, bgColor } = this.props;
    bgColor = bgColor || PROJECT_ICON_COLORS[0];
    icon = PROJECT_ICON_ALL_LIST.includes(icon) ? icon : DEFAULT_PROJECT_ICON;
    const [red, green, blue] = parseColorToRGB(bgColor);
    const selectedBackgroundColor = [red, green, blue].every((value) => value !== undefined)
      ? `rgba(${red}, ${green}, ${blue}, 0.1)`
      : bgColor;
    const pinnedIcon = this.getPinnedIcon(icon) || this.state.pinnedIcon;
    const iconList = pinnedIcon ? [pinnedIcon, ...PROJECT_ICON_LIST] : PROJECT_ICON_LIST;
    return (
      <div className="project-setting-content-icon-section">
        <div className="project-setting-content-icon-header">
          <div className="form-label project-setting-content-label mb-0">{gettext('Icon')}</div>
          <IconButton
            icon="arrow-right"
            className="project-setting-content-view-all"
            role="button"
            tabIndex={0}
            onClick={this.onViewAll}
            onKeyDown={this.onViewAllKeyDown}
          >
            <span>{gettext('View All')}</span>
          </IconButton>
        </div>
        <div className="project-setting-content-icons">
          {iconList.map((iconItem) => {
            const isSelected = iconItem === icon;
            return (
              <div
                key={iconItem}
                className="project-setting-content-icon-item"
                onClick={() => this.onIconChange(iconItem)}
                role="button"
                style={{ backgroundColor: isSelected ? selectedBackgroundColor : '' }}
                title={`${gettext('Icon')} ${iconItem}`}
                aria-label={`${gettext('Icon')} ${iconItem}`}
              >
                <span className="colorinput project-setting-content-icon-input" aria-selected={isSelected}>
                  <i
                    aria-hidden="true"
                    className={`project-icon project-icon-style ${iconItem}`}
                    style={{ color: isSelected ? bgColor : '' }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  render() {
    return (
      <div className="project-setting-content">
        {this.renderName()}
        {this.renderColorSettings()}
        {this.renderIconSettings()}
      </div>
    );
  }
}

export default ProjectSettingContent;
