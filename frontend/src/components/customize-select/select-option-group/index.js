import React, { Component } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import Option from './option';
import SearchInput from '../../search-input';
import { KeyCodes } from '@/constants/keyCodes';
import ClickOutside from '../../click-outside';
import Tip from '../../option-editor/tip';

import './index.css';

const OPTION_HEIGHT = 32;

const getSelectKey = (value) => {
  if (value == null) return null;
  if (typeof value !== 'object') return `${value}`;

  if (value.selectedKey !== undefined) return `${value.selectedKey}`;
  if (value.selectedKeys !== undefined && Array.isArray(value.selectedKeys)) return value.selectedKeys.map(item => `${item}`).join('|');
  if (value.value !== undefined) return getSelectKey(value.value);
  if (value.column && value.column.key !== undefined) return `column:${value.column.key}`;
  if (value.sortType !== undefined) return `sortType:${value.sortType}`;
  if (value.filterPredicate !== undefined) return `filterPredicate:${value.filterPredicate}`;
  if (value.filterConjunction !== undefined) return `filterConjunction:${value.filterConjunction}`;
  if (value.filterTermModifier !== undefined) return `filterTermModifier:${value.filterTermModifier}`;
  if (value.id !== undefined) return `id:${value.id}`;
  if (value.key !== undefined) return `key:${value.key}`;
  if (value.columnOption && value.columnOption.id !== undefined) return `columnOption:${value.columnOption.id}`;
  if (value.tag && value.tag.id !== undefined) return `tag:${value.tag.id}`;

  return null;
};

class OptionGroup extends Component {

  constructor(props) {
    super(props);
    this.state = {
      searchVal: '',
      activeIndex: -1,
      disableHover: false,
    };
    this.filterOptions = null;
    this.timer = null;
    this.searchInputRef = React.createRef();
  }

  componentDidMount() {
    window.addEventListener('keydown', this.onHotKey);
    setTimeout(() => {
      this.resetMenuStyle();
    }, 1);
  }

  componentWillUnmount() {
    this.filterOptions = null;
    this.timer && clearTimeout(this.timer);
    window.removeEventListener('keydown', this.onHotKey);
  }

  resetMenuStyle = () => {
    if (!this.optionGroupRef) return;
    const { isInModal, position, searchable } = this.props;
    const { top, height } = this.optionGroupRef.getBoundingClientRect();
    if (isInModal) {
      if (position.y + position.height + height > window.innerHeight) {
        this.optionGroupRef.style.top = (position.y - height) + 'px';
      }
      this.optionGroupRef.style.opacity = 1;
      this.searchInputRef.current && this.searchInputRef.current.inputRef.focus();
      return;
    }
    if (height + top > window.innerHeight) {
      const borderWidth = 2;
      this.optionGroupRef.style.top = -1 * (height + borderWidth) + 'px';
      setTimeout(() => {
        const { top } = this.optionGroupRef.getBoundingClientRect();
        if (top < 0) {
          const { height: parentNodeHeight, top: parentNodeTop } = this.optionGroupRef.parentNode.getBoundingClientRect();
          this.optionGroupRef.style.top = 'unset';
          this.optionGroupRef.style.bottom = parentNodeHeight + 'px';
          this.optionGroupRef.style.maxHeight = parentNodeTop - 4 + 'px';
          // 30: paddingTop/paddingBottom(12) + borderTop/borderBottom(2) + gap(4)
          this.optionGroupContentRef.style.maxHeight = parentNodeTop - (searchable ? (28 + 8) : 0) - 30 + 'px';
        }
      }, 1);
    }
  };

  onHotKey = (event) => {
    const keyCode = event.keyCode;
    if (keyCode === KeyCodes.UpArrow) {
      this.onPressUp();
    } else if (keyCode === KeyCodes.DownArrow) {
      this.onPressDown();
    } else if (keyCode === KeyCodes.Enter) {
      let option = this.filterOptions && this.filterOptions[this.state.activeIndex];
      if (option) {
        this.props.onChange(option.value);
        if (!this.props.supportMultipleSelect) {
          this.props.closeSelect();
        }
      }
    } else if (keyCode === KeyCodes.Tab || keyCode === KeyCodes.Escape) {
      this.props.closeSelect();
    }
  };

  onPressUp = () => {
    if (this.state.activeIndex > 0) {
      this.setState({ activeIndex: this.state.activeIndex - 1 }, () => {
        this.scrollContent();
      });
    }
  };

  onPressDown = () => {
    if (this.filterOptions && this.state.activeIndex < this.filterOptions.length - 1) {
      this.setState({ activeIndex: this.state.activeIndex + 1 }, () => {
        this.scrollContent();
      });
    }
  };

  onMouseDown = (e) => {
    const { isInModal } = this.props;
    // prevent event propagation when click option or search input
    if (isInModal) {
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  scrollContent = () => {
    const { offsetHeight, scrollTop } = this.optionGroupContentRef;
    this.setState({ disableHover: true });
    this.timer = setTimeout(() => {
      this.setState({ disableHover: false });
    }, 500);
    if (this.state.activeIndex * OPTION_HEIGHT === 0) {
      this.optionGroupContentRef.scrollTop = 0;
      return;
    }

    if (this.state.activeIndex * OPTION_HEIGHT < scrollTop) {
      this.optionGroupContentRef.scrollTop = scrollTop - OPTION_HEIGHT;
    }
    else if (this.state.activeIndex * OPTION_HEIGHT > offsetHeight + scrollTop) {
      this.optionGroupContentRef.scrollTop = scrollTop + OPTION_HEIGHT;
    }
  };

  changeIndex = (index) => {
    this.setState({ activeIndex: index });
  };

  onChangeSearch = (searchVal) => {
    let value = searchVal || '';
    if (value !== this.state.searchVal) {
      this.setState({ searchVal: value, activeIndex: -1, });
    }
  };

  onClear = () => {
    this.setState({ searchVal: '', activeIndex: -1, });
  };

  renderOptGroup = (searchVal) => {
    let { noOptionsPlaceholder, onChange, value, hideSelectedValue } = this.props;
    this.filterOptions = this.props.getFilterOptions(searchVal);
    const selectedKeys = this.getSelectedKeys(value);
    if (this.filterOptions.length === 0) {
      return (<Tip searchValue={searchVal} tip={noOptionsPlaceholder} />);
    }
    return this.filterOptions.map((opt, i) => {
      let key = opt.value.column ? opt.value.column.key : i;
      let isActive = this.state.activeIndex === i;
      const optionKey = opt.selectedKey !== undefined ? `${opt.selectedKey}` : getSelectKey(opt.value);
      const isSelected = hideSelectedValue ? false : selectedKeys.includes(optionKey);
      return (
        <Option
          key={`${key}-${i}`}
          index={i}
          isActive={isActive}
          isSelected={isSelected}
          value={opt.value}
          onChange={onChange}
          changeIndex={this.changeIndex}
          supportMultipleSelect={this.props.supportMultipleSelect}
          disableHover={this.state.disableHover}
        >
          {opt.label}
        </Option>
      );
    });
  };

  getSelectedKeys = (value) => {
    const { selectedKey, selectedKeys } = this.props;
    if (Array.isArray(selectedKeys)) {
      return selectedKeys.map(item => `${item}`);
    }
    if (selectedKey !== undefined && selectedKey !== null) {
      return [`${selectedKey}`];
    }
    const resolvedKey = getSelectKey(value);
    return resolvedKey === null ? [] : [`${resolvedKey}`];
  };

  render() {
    const { searchable, searchPlaceholder, top, left, minWidth, value, isShowSelected, isInModal, position,
      className, addOptionAble, component } = this.props;
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
      <ClickOutside onClickOutside={this.props.onClickOutside}>
        <div
          className={classnames('option-group', className ? 'option-group-' + className : '', {
            'pt-0': isShowSelected,
            'create-new-option-group': addOptionAble,
            'searchable': searchable
          })}
          ref={(ref) => this.optionGroupRef = ref}
          style={style}
          onMouseDown={this.onMouseDown}
        >
          {isShowSelected &&
            <div className="editor-list-delete mb-2" onClick={(e) => e.stopPropagation()}>{value.label || ''}</div>
          }
          {searchable && (
            <div className="option-group-search">
              <SearchInput
                className="option-search-control"
                placeholder={searchPlaceholder}
                onChange={this.onChangeSearch}
                autoFocus={true}
                isShowSearchIcon={false}
                size={32}
                ref={this.searchInputRef}
                isShowClearIcon={searchVal ? true : false}
                onClear={this.onClear}
              />
            </div>
          )}
          <div className="option-group-content" ref={(ref) => this.optionGroupContentRef = ref}>
            {this.renderOptGroup(searchVal)}
          </div>
          {addOptionAble && AddOption}
        </div>
      </ClickOutside>
    );
  }
}

OptionGroup.propTypes = {
  top: PropTypes.number,
  left: PropTypes.number,
  minWidth: PropTypes.number,
  options: PropTypes.array,
  onChange: PropTypes.func,
  searchable: PropTypes.bool,
  addOptionAble: PropTypes.bool,
  component: PropTypes.object,
  searchPlaceholder: PropTypes.string,
  noOptionsPlaceholder: PropTypes.string,
  onClickOutside: PropTypes.func.isRequired,
  closeSelect: PropTypes.func.isRequired,
  getFilterOptions: PropTypes.func.isRequired,
  supportMultipleSelect: PropTypes.bool,
  value: PropTypes.object,
  selectedKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selectedKeys: PropTypes.array,
  isShowSelected: PropTypes.bool,
  stopClickEvent: PropTypes.bool,
  isInModal: PropTypes.bool,
  position: PropTypes.object,
  className: PropTypes.string,
};

export default OptionGroup;
