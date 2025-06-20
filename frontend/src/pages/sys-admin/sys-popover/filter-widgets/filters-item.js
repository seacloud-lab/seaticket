import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../../constants';
import { SHOW_STATUS_TYPES } from '../../sys-constants/sys-filter-constants';

const propTypes = {
  isShowClearBtn: PropTypes.bool,
  selectedChecked: PropTypes.string,
  filterTitle: PropTypes.string,
  selectedOptions: PropTypes.array,
  updatedFilerCheckedSelected: PropTypes.func,
  onClearFilter: PropTypes.func,
};

class FiltersItem extends React.Component {

  updatedFilerCheckedSelected = (item) => {
    this.props.updatedFilerCheckedSelected(item);
  };

  render() {
    const { filterTitle, selectedOptions, selectedChecked, isShowClearBtn, onClearFilter } = this.props;
    return (
      <div className="sys-filter-item">
        <div className="sys-filter-title">
          {filterTitle}
          {isShowClearBtn && <span className="sys-clear-filter" onClick={onClearFilter}>{gettext('Clear')}</span>}
        </div>
        <div className="sys-filter-check">
          {selectedOptions.map((item, index) => {
            return (
              <div className="sys-filter-check-operator" key={index}>
                <input
                  type="radio"
                  checked={selectedChecked === item}
                  onChange={() => this.updatedFilerCheckedSelected(item)}
                />
                {SHOW_STATUS_TYPES[item] && < span className="pl-2">{gettext(SHOW_STATUS_TYPES[item])}</span>}
                {!SHOW_STATUS_TYPES[item] && < span className="pl-2">{item}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}

FiltersItem.propTypes = propTypes;

export default FiltersItem;
