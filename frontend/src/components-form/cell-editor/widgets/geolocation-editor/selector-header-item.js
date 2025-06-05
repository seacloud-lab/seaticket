import React from 'react';
import PropTypes from 'prop-types';

const SelectorHeaderItemPropTypes = {
  type: PropTypes.string,
  clickHandler: PropTypes.func,
  selectedType: PropTypes.string,
  selectedItem: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
};

const gettext = window.gettext;

class SelectorHeaderItem extends React.Component {

  render() {
    const { type, clickHandler, selectedType, selectedItem } = this.props;
    return (
      <div
        className={
          'geolocation-selector-header-item ' +
          (selectedType === type
            ? 'selected-geolocation-selector-header-item'
            : '')
        }
        onClick={() => {
          clickHandler(type);
        }}
      >
        <span>
          {selectedItem ? selectedItem.name ? selectedItem.name : selectedItem : gettext('Select location')}
        </span>
        <i className="dtable-font dtable-icon-down3"></i>
      </div>
    );
  }
}

SelectorHeaderItem.propTypes = SelectorHeaderItemPropTypes;

export default SelectorHeaderItem;
