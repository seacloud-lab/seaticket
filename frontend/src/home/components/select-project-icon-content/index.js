import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { SearchInput } from '@/components';
import { DEFAULT_PROJECT_ICON, PROJECT_ICON_CATEGORIES, PROJECT_ICON_COLORS, gettext } from '@/constants';
import { parseColorToRGB } from '@/utils/color-utils';

import './index.css';

const PROJECT_ICON_CATEGORY_NAMES = {
  common: gettext('Common Icons'),
  'system-devices': gettext('System & Devices Icons'),
  'transport-location': gettext('Transport & Location Icons'),
  'entertainment-games': gettext('Entertainment & Games Icons'),
  'medical-health': gettext('Medical & Health Icons'),
  'design-geometry': gettext('Design & Geometry Icons'),
  'objects-daily-life': gettext('Objects & Daily Life Icons'),
  'nature-science': gettext('Nature & Science Icons'),
  'business-finance': gettext('Business & Finance Icons'),
};

const propTypes = {
  bgColor: PropTypes.string,
  currentIcon: PropTypes.string,
  onPrevious: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

class SelectProjectIconContent extends React.Component {

  state = {
    searchValue: '',
    selectedIcon: this.props.currentIcon || DEFAULT_PROJECT_ICON,
  };

  onSearch = (searchValue) => {
    this.setState({ searchValue });
  };

  onClearSearch = () => {
    this.setState({ searchValue: '' });
  };

  onSelectIcon = (selectedIcon) => {
    this.setState({ selectedIcon });
  };

  onSubmit = () => {
    this.props.onSubmit(this.state.selectedIcon);
  };

  getIconLabel = (icon) => {
    return icon.replace(/^haiwen-/, '').replace(/-fill$/, '').replace(/-/g, ' ');
  };

  getFilteredCategories = () => {
    const searchValue = this.state.searchValue.toLowerCase();
    if (!searchValue) return PROJECT_ICON_CATEGORIES;

    return PROJECT_ICON_CATEGORIES.map((category) => {
      const icons = category.icons.filter((icon) => {
        const iconName = this.getIconLabel(icon);
        return icon.toLowerCase().includes(searchValue) || iconName.includes(searchValue);
      });
      return { ...category, icons };
    }).filter((category) => category.icons.length > 0);
  };

  render() {
    const { bgColor, onPrevious } = this.props;
    const selectedColor = bgColor || PROJECT_ICON_COLORS[0];
    const [red, green, blue] = parseColorToRGB(selectedColor);
    const selectedBackgroundColor = [red, green, blue].every((value) => value !== undefined)
      ? `rgba(${red}, ${green}, ${blue}, 0.1)`
      : selectedColor;
    const { selectedIcon } = this.state;
    const categories = this.getFilteredCategories();
    return (
      <div className="select-project-icon-content">
        <SearchInput
          value={this.state.searchValue}
          onChange={this.onSearch}
          onClear={this.onClearSearch}
          isShowClearIcon={true}
          autoFocus={true}
          wait={0}
          placeholder={gettext('Search icons')}
          className="select-project-icon-content-search"
        />
        {categories.length > 0 ? (
          <div className="select-project-icon-content-categories">
            {categories.map((category) => (
              <section className="select-project-icon-content-category" key={category.id}>
                <div className="select-project-icon-content-category-title">
                  {PROJECT_ICON_CATEGORY_NAMES[category.id] || category.name}
                </div>
                <div className="select-project-icon-content-list">
                  {category.icons.map((icon) => {
                    const isSelected = icon === selectedIcon;
                    const iconLabel = this.getIconLabel(icon);
                    return (
                      <button
                        type="button"
                        key={icon}
                        className="select-project-icon-content-item"
                        style={{ backgroundColor: isSelected ? selectedBackgroundColor : '' }}
                        onClick={() => this.onSelectIcon(icon)}
                        title={iconLabel}
                        aria-label={`${gettext('Icon')} ${iconLabel}`}
                        aria-pressed={isSelected}
                      >
                        <i
                          aria-hidden="true"
                          className={`project-icon project-icon-style ${icon}`}
                          style={{ color: isSelected ? selectedColor : '' }}
                        />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="select-project-icon-content-empty text-secondary text-center">{gettext('No icons')}</div>
        )}
        <div className="select-project-icon-content-footer">
          <Button color="secondary" onClick={onPrevious}>{gettext('Previous')}</Button>
          <Button color="primary" onClick={this.onSubmit}>{gettext('Submit')}</Button>
        </div>
      </div>
    );
  }
}

SelectProjectIconContent.propTypes = propTypes;

export default SelectProjectIconContent;
