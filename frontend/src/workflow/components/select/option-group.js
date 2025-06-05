import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DTableSearchInput } from 'dtable-ui-component';
import SelectOption from '../common/select-option';

import '../../css/select/option-group.css';

class OptGroup extends Component {

  constructor(props) {
    super(props);
    this.state = {
      searchVal: '',
      activeIndex: -1,
    };
    this.filterOptions = null;
  }

  componentDidMount() {
    window.addEventListener('click', this.onClick, true);
    // Make sure child component is rendered, so current component can be stretched out, then get the correct size
    setTimeout(() => {
      this.resetMenuStyle();
    }, 1);
  }

  componentWillUnmount() {
    this.filterOptions = null;
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

  onChangeSearch = (searchVal) => {
    const value = searchVal || '';
    if (value !== this.state.searchVal) {
      this.setState({ searchVal: value, activeIndex: -1 });
    }
  };

  renderOptGroup = (searchVal) => {
    const { noOptionsPlaceholder, onSelectOption, supportMultipleSelect } = this.props;
    this.filterOptions = this.props.getFilterOptions(searchVal);
    if (this.filterOptions === 0) {
      return (
        <div className="none-search-result">{noOptionsPlaceholder}</div>
      );
    }
    return this.filterOptions.map((opt, i) => {
      let key = opt.value.column ? opt.value.column.key : i;
      let isActive = this.state.activeIndex === i;
      return (
        <SelectOption
          key={key}
          index={i}
          isActive={isActive}
          value={opt.value}
          onSelectOption={onSelectOption}
          changeIndex={this.changeIndex}
          supportMultipleSelect={supportMultipleSelect}
        >
          {opt.label}
        </SelectOption>
      );
    });
  };

  render() {
    const { searchable, searchPlaceholder, top, left, minWidth, value, isShowSelected,
      addOptionAble, component, isInModal, position } = this.props;
    const { AddOption } = component || {};
    let { searchVal } = this.state;
    let style = { top: top || 0, left: left || 0 };
    if (minWidth) {
      style = { top: top || 0, left: left || 0, minWidth };
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
      <div
        className={`option-group ${isShowSelected ? 'pt-0' : ''} ${addOptionAble ? 'create-new-option-group' : ''}`}
        ref={(ref) => this.optionGroupRef = ref}
        style={style}
      >
        {isShowSelected &&
          <div className="editor-list-delete mb-2" onClick={(e) => e.stopPropagation()}>{value.label || ''}</div>
        }
        {searchable && (
          <div className="option-group-search">
            <DTableSearchInput
              className="option-search-control"
              placeholder={searchPlaceholder}
              onChange={this.onChangeSearch}
              autoFocus={true}
            />
          </div>
        )}
        <div className="option-group-content">
          {this.renderOptGroup(searchVal)}
        </div>
        {addOptionAble && AddOption}
      </div>
    );
  }
}

OptGroup.propTypes = {
  isShowSelected: PropTypes.bool,
  stopClickEvent: PropTypes.bool,
  addOptionAble: PropTypes.bool,
  searchable: PropTypes.bool,
  supportMultipleSelect: PropTypes.bool,
  isInModal: PropTypes.bool,
  position: PropTypes.object,
  top: PropTypes.number,
  left: PropTypes.number,
  minWidth: PropTypes.number,
  options: PropTypes.array,
  searchPlaceholder: PropTypes.string,
  noOptionsPlaceholder: PropTypes.string,
  component: PropTypes.object,
  value: PropTypes.object,
  closeSelect: PropTypes.func.isRequired,
  onSelectOption: PropTypes.func,
  getFilterOptions: PropTypes.func,
};

export default OptGroup;
