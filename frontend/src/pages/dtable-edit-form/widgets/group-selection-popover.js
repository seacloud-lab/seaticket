import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../utils/constants';

const propTypes = {
  popoverStyle: PropTypes.object.isRequired,
  groups: PropTypes.array.isRequired,
  selectedGroups: PropTypes.array.isRequired,
  onOptionItemToggle: PropTypes.func.isRequired,
};

class GroupSelectionPopover extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      searchValue: '',
    };
  }

  onValueChanged = (e) => {
    let value = e.target.value.trim();
    this.setState({searchValue: value});
  };

  onInputClick = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
  } 

  onOptionItemToggle = (group) => {
    this.props.onOptionItemToggle(group);
  };

  getFilterGroups = () => {
    let { groups } = this.props;
    let filter = this.state.searchValue.toLowerCase();
    if (!filter) {
      return groups;
    }
    return groups.filter(groups => {
      return (groups.name.toString().toLowerCase()).indexOf(filter) > -1;
    });
  };

  render() {

    let { popoverStyle, selectedGroups } = this.props;
    let groups = this.getFilterGroups();

    return (
      <div className="group-selection-popover" style={popoverStyle}>
        <div className="group-selections-search">
          <input className="form-control" onChange={this.onValueChanged} onClick={this.onInputClick} placeholder={gettext('Search group')}></input>
        </div>
        <div className="group-selections-container">
          {groups.length > 0 && groups.map((group, index) => {
            // check is selected
            let isSelect = selectedGroups.some(selectGroup => {
              return selectGroup.id === group.id;
            });
            return (
              <div key={index} className="group-selection-item" onClick={this.onOptionItemToggle.bind(this, group)}>
                <div className="group-name text-truncate">{group.name}</div>
                <div className="group-checked">
                  {isSelect && <i className="dtable-font dtable-icon-check-mark" style={{fontSize: '12px'}}></i>}
                </div>
              </div>
            );
          })}
          {groups.length === 0 && (<div className="search-option-null">{gettext('No group available')}</div>)}
        </div>
      </div>
    );
  }
}

GroupSelectionPopover.propTypes = propTypes;

export default GroupSelectionPopover;
