import React from 'react';
import PropTypes from 'prop-types';

const SelectorListPropTypes = {
  type: PropTypes.string,
  parent: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  selectedItem: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  clickHandler: PropTypes.func,
  doubleClickHandler: PropTypes.oneOfType([PropTypes.func, PropTypes.object])
};


class SelectorList extends React.Component {
  render() {
    const { clickHandler, type, selectedItem, parent, doubleClickHandler } = this.props;
    return (
      <ul className="geolocation-selector-list">
        {parent.children.map((item, index) => {
          const isSelected = selectedItem && (item.name === selectedItem.name);
          return (
            <li
              onClick={() => clickHandler(item)}
              onDoubleClick={() => {doubleClickHandler && doubleClickHandler(item);}}
              key={type + '-item-' + index}
              className={`geolocation-selector-list-item ${type === 'province' ? 'province-item' : ''} ${
                isSelected ? 'selected-list-item' : ''
              }`}
            >
              {item.name}
            </li>
          );
        })}
      </ul>
    );
  }
}

SelectorList.propTypes = SelectorListPropTypes;

export default SelectorList;
