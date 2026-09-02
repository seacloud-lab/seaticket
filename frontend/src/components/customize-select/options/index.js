import React, { Component } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import Option from './option';
import SearchInput from '../../search-input';
import { KeyCodes } from '@/constants/keyCodes';
import ClickOutside from '../../click-outside';
import EmptyTip from '@/components/empty-tip';
import { isNumber, isString } from '@/utils/type-detection';
import { searchOptions } from '@/utils/search';

import './index.css';
import { gettext } from '@/constants';

const OPTION_HEIGHT = 32;
const INDENT = 4;

const initOffset = (offset) => {
  if (!offset && offset !== 0) return [0, INDENT];
  if (isNumber(offset)) return [offset, offset];
  if (Array.isArray(offset)) {
    if (offset.length === 0) return [0, INDENT];
    if (offset.length === 1) return [offset[0], offset[0]];
    return [offset[0], offset[1]];
  }
  return [0, INDENT];
};

class Options extends Component {

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
    if (!this.optionsContainerRef) return;
    const { isInModal, position } = this.props;
    const offset = initOffset(this.props.offset);
    const { top, height } = this.optionsContainerRef.getBoundingClientRect();
    if (isInModal) {
      if (position.y + position.height + height + 10 > window.innerHeight) {
        const maxHeight = Math.min(height, position.top - 10, 300);
        this.optionsContainerRef.style.top = (position.y - maxHeight - offset[1]) + 'px';
        this.optionsContainerRef.style.maxHeight = maxHeight + 'px';
      }
      this.optionsContainerRef.style.opacity = 1;
      this.searchInputRef.current && this.searchInputRef.current.inputRef.focus();
      return;
    }
    if (height + top > window.innerHeight) {
      const { height: parentNodeHeight, top: parentNodeTop } = this.optionsContainerRef.parentNode.getBoundingClientRect();
      this.optionsContainerRef.style.top = 'unset';
      this.optionsContainerRef.style.bottom = parentNodeHeight + offset[1] + 'px';
      setTimeout(() => {
        const { top } = this.optionsContainerRef.getBoundingClientRect();
        if (top < 0) {
          this.optionsContainerRef.style.maxHeight = parentNodeTop - offset[1] - 10 + 'px';
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
          this.props.closeSelector();
        }
      }
    } else if (keyCode === KeyCodes.Tab || keyCode === KeyCodes.Escape) {
      this.props.closeSelector();
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
      return;
    }
    if (this.state.activeIndex * OPTION_HEIGHT > offsetHeight + scrollTop) {
      this.optionGroupContentRef.scrollTop = scrollTop + OPTION_HEIGHT;
      return;
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
    const { noOptionsPlaceholder, onChange, value, supportMultipleSelect, options } = this.props;
    this.filterOptions = searchOptions(options, searchVal);
    if (this.filterOptions.length === 0) {
      return (
        <EmptyTip text={searchVal ? gettext('No results') : noOptionsPlaceholder} className="seaqa-customize-select-empty-tip" />
      );
    }
    return this.filterOptions.map((opt, i) => {
      const key = opt.value.column ? opt.value.column.key : i;
      const isActive = this.state.activeIndex === i;
      const isSelected = Array.isArray(value) ? value.includes(opt.value) : value === opt.value;
      return (
        <Option
          key={`${key}-${i}`}
          index={i}
          isActive={isActive}
          isSelected={isSelected}
          value={opt.value}
          onChange={onChange}
          changeIndex={this.changeIndex}
          supportMultipleSelect={supportMultipleSelect}
          disableHover={this.state.disableHover}
        >

          {isString(opt.label) ?
            (<span className="text-truncate" title={opt.label} aria-label={opt.label}>{opt.label}</span>)
            :
            (<>{opt.label}</>)
          }
        </Option>
      );
    });
  };

  render() {
    const { searchable, searchPlaceholder, top, left, minWidth, isInModal, position,
      className } = this.props;
    let { searchVal } = this.state;
    const offset = initOffset(this.props.offset);
    let style = isInModal ? {
      position: 'fixed',
      left: position.x,
      top: position.y + position.height + offset[1],
      minWidth: position.width,
      opacity: 0,
    } : {
      left: (left || 0) + offset[0],
      top: (top || 0) + offset[1],
    };
    if (minWidth) {
      style['minWidth'] = minWidth;
    }
    return (
      <ClickOutside onClickOutside={this.props.onClickOutside}>
        <div
          className={classnames('seaqa-select-options-container', className, { 'searchable': searchable })}
          ref={ref => this.optionsContainerRef = ref}
          style={style}
          onMouseDown={this.onMouseDown}
        >
          {searchable && (
            <div className="seaqa-select-options-search-container">
              <SearchInput
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
          <div className="seaqa-select-options" ref={(ref) => this.optionGroupContentRef = ref}>
            {this.renderOptGroup(searchVal)}
          </div>
        </div>
      </ClickOutside>
    );
  }
}

Options.propTypes = {
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
  closeSelector: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array, PropTypes.number]),
  isInModal: PropTypes.bool,
  position: PropTypes.object,
  className: PropTypes.string,
};

export default Options;
