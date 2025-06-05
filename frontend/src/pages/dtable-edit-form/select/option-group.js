import React, { Component } from 'react';
import Option from './option';
import PropTypes from 'prop-types';
import { ClickOutside } from 'dtable-ui-component';

import '../css/option-group.css';

const propTypes = {
  top: PropTypes.number,
  left: PropTypes.number,
  minWidth: PropTypes.number,
  options: PropTypes.array,
  onSelectOption: PropTypes.func,
  searchable: PropTypes.bool,
  isInModal: PropTypes.bool,
  position: PropTypes.object,
  searchPlaceholder: PropTypes.string,
  noOptionsPlaceholder: PropTypes.string,
  closeSelect: PropTypes.func.isRequired,
  supportMultipleSelect: PropTypes.bool,
  value: PropTypes.object,
  isShowSelected: PropTypes.bool,
  stopClickEvent: PropTypes.bool,
  onClickOutside: PropTypes.func,
};

class OptGroup extends Component {
  constructor(props) {
    super(props);
    this.state = {
      searchVal: '',
      activeIndex: -1,
    };
  }

  componentDidMount() {
    window.addEventListener('click', this.onClick, true);
    // Make sure child component is rendered, so current component can be stretched out, then get the correct size
    setTimeout(() => {
      this.resetMenuStyle();
    }, 1);
  }

  componentWillUnmount() {
    window.removeEventListener('click', this.onClick, true);
  }

  resetMenuStyle = () => {
    const { isInModal, position } = this.props;
    const { top, height } = this.optionGroupRef.getBoundingClientRect();
    if (isInModal) {
      if (position.y + position.height + height > window.innerHeight) {
        this.optionGroupRef.style.top = (position.y - height) + 'px';
      }
      this.optionGroupRef.style.opacity = 1;
    } else {
      if (height + top > window.innerHeight) {
        const borderWidth = 2;
        this.optionGroupRef.style.top = -1 * (height + borderWidth) + 'px';
      }
    }
  };

  onClick = (e) => {
    if (this.props.stopClickEvent && this.optionGroupRef.contains(e.target) && !e.target.className.includes('dtable-font')) {
      e.stopPropagation();
    }
  };

  changeIndex = (index) => {
    this.setState({ activeIndex: index });
  };

  onChangeSearch = (e) => {
    let value = e.target.value;
    if (value !== this.state.searchVal) {
      this.setState({searchVal: value, activeIndex: -1,});
    }
  };

  renderOptGroup = (searchVal) => {
    let { options, searchable, noOptionsPlaceholder, onSelectOption } = this.props;
    let filterOptions = options || [];
    if (searchable) {
      let validSearchVal = searchVal.trim().toLowerCase();
      if (validSearchVal) {
        filterOptions = options.filter(option => {
          const { value, name } = option;
          if (typeof name === 'string') {
            return name.toLowerCase().indexOf(validSearchVal) > -1;
          } else if (typeof value === 'object') {
            return value.columnOption && value.columnOption.name.toLowerCase().indexOf(validSearchVal) > -1;
          } else {
            return false;
          }
        });
      }
    }
    if (filterOptions.length > 0) {
      return filterOptions.map((opt, i) => {
        let key = opt.value.column ? opt.value.column.key : i;
        let isActive = this.state.activeIndex === i;
        return (
          <Option
            key={key}
            index={i}
            isActive={isActive}
            value={opt.value}
            onSelectOption={onSelectOption}
            changeIndex={this.changeIndex}
            supportMultipleSelect={this.props.supportMultipleSelect}
          >
            {opt.label}
          </Option>
        );
      });
    }
    return (
      <div className="none-search-result">{noOptionsPlaceholder}</div>
    );
  };

  render() {
    const { searchable, searchPlaceholder, top, left, minWidth, value, isShowSelected, onClickOutside, isInModal, position } = this.props;
    let { searchVal } = this.state;
    let style = {top: top || 0, left: left || 0 };
    if (minWidth) {
      style = {top: top || 0, left: left || 0, minWidth};
    }
    if (isInModal) {
      style = {
        position: 'fixed',
        left: position.x,
        top: position.y + position.height,
        minWidth: position.width,
        opacity: 0,
      };
    }
    return (
      <ClickOutside onClickOutside={onClickOutside}>
        <div
          className={`option-group ${isShowSelected ? 'pt-0' : ''}`}
          ref={(ref) => this.optionGroupRef = ref}
          style={style}
        > 
          {isShowSelected &&
          <div className="editor-list-delete mb-2" onClick={(e) => e.stopPropagation()}>{value.label || ''}</div>
          }
          {searchable && (
            <div className="option-group-search">
              <input
                className="form-control option-search-control"
                type="text"
                placeholder={searchPlaceholder}
                value={searchVal}
                onChange={this.onChangeSearch}
                autoFocus
              />
            </div>
          )}
          <div className="option-group-content">
            {this.renderOptGroup(searchVal)}
          </div>
        </div>
      </ClickOutside>
    );
  }
}

OptGroup.propTypes = propTypes;

export default OptGroup;
