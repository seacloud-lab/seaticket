import React from 'react';
import PropTypes from 'prop-types';
import { DTablePopover } from 'dtable-ui-component';
import { gettext } from '../../utils/constants';
import { Utils } from '../../utils/utils';

const propTypes = {
  isMultipleSelect: PropTypes.bool,
  target: PropTypes.string.isRequired,
  options: PropTypes.array.isRequired,
  selectedOptions: PropTypes.array.isRequired,
  onOptionItemToggle: PropTypes.func.isRequired,
  onSelectEditorPopoverToggle: PropTypes.func.isRequired,
};

class SelectEditorPopover extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      searchValue: '',
      maxItemNum: 0,
      itemHeight: 0,
      highlightIndex: -1,
    };
  }

  componentDidMount() {
    if (this.selectContainer && this.selectItem) {
      this.setState({
        maxItemNum: this.getMaxItemNum(),
        itemHeight: parseInt(getComputedStyle(this.selectItem, null).height),
        highlightIndex: this.getInitHighLightIndex(),
      });
    }
    document.addEventListener('keydown', this.onHotKey, true);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onHotKey, true);
  }

  onHotKey = (e) => {
    if (e.keyCode === Utils.keyCodes.enter) {
      this.onEnter(e);
    } else if (e.keyCode === Utils.keyCodes.up) {
      this.onUpArrow(e);
    } else if (e.keyCode === Utils.keyCodes.down) {
      this.onDownArrow(e);
    }
  };

  onEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    let option;
    const options = this.getFilterOptions();
    option = options[this.state.highlightIndex];
    if (option) {
      this.props.onOptionItemToggle(option);
    }
  };

  onUpArrow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { highlightIndex, maxItemNum, itemHeight } = this.state;
    if (highlightIndex > 0) {
      this.setState({ highlightIndex: highlightIndex - 1 }, () => {
        const filteredOptions = this.getFilterOptions();
        if (highlightIndex < filteredOptions.length - maxItemNum) {
          this.selectContainer.scrollTop -= itemHeight;
        }
      });
    }
  };

  onDownArrow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { highlightIndex, maxItemNum, itemHeight } = this.state;
    const filteredOptions = this.getFilterOptions();
    if (highlightIndex < filteredOptions.length - 1) {
      this.setState({ highlightIndex: highlightIndex + 1 }, () => {
        if (highlightIndex >= maxItemNum) {
          this.selectContainer.scrollTop += itemHeight;
        }
      });
    }
  };

  onValueChanged = (event) => {
    let value = event.target.value.trim();
    this.setState({ searchValue: value });
  };

  onInputClick = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
  };

  onOptionItemToggle = (item, e) => {
    e.preventDefault();
    e.stopPropagation();
    this.props.onOptionItemToggle(item);
  };

  getInitHighLightIndex = () => {
    const { selectedOptions, isMultipleSelect } = this.props;
    if (isMultipleSelect || selectedOptions.length === 0) return -1;
    const option = selectedOptions[0];
    const value = option.id;
    const options = this.getFilterOptions();
    const highlightIndex = options.findIndex(option => option.id === value);
    return highlightIndex;
  };

  getMaxItemNum = () => {
    let selectContainerStyle = getComputedStyle(this.selectContainer, null);
    let selectItemStyle = getComputedStyle(this.selectItem, null);
    let maxSelectItemNum = Math.floor(parseInt(selectContainerStyle.maxHeight) / parseInt(selectItemStyle.height));
    return maxSelectItemNum - 1;
  };

  getFilterOptions = () => {
    let { options } = this.props;
    let filter = this.state.searchValue.toLowerCase();
    if (!filter) {
      return options;
    }
    return options.filter(option => {
      return (option.name.toString().toLowerCase()).indexOf(filter) > -1;
    });
  };

  getOptionStyle = (option) => {
    const textColor = option.textColor || null;
    return {
      display: 'inline-block',
      padding: '0px 10px',
      height: '20px',
      lineHeight: '20px',
      borderRadius: '10px',
      fontSize: '13px',
      backgroundColor: option.color,
      color: textColor,
    };
  };

  render() {
    let { selectedOptions, target } = this.props;
    let options = this.getFilterOptions();
    let showSearch = this.props.options.length > 10;
    return (
      <DTablePopover
        hideArrow
        popoverClassName="select-editor-popover"
        target={target}
        placement="bottom-start"
        hideDTablePopover={this.props.onSelectEditorPopoverToggle}
        hideDTablePopoverWithEsc={this.props.onSelectEditorPopoverToggle}
      >
        <div className="select-editor-popover">
          {showSearch &&
            <div className="select-options-search">
              <input
                className="form-control"
                onChange={this.onValueChanged}
                onMouseDown={this.onInputClick}
                placeholder={gettext('Search option')}>
              </input>
            </div>
          }
          <div className="select-options-container" ref={ref => this.selectContainer = ref}>
            {options.length > 0 && options.map((option, index) => {
              let optionStyle = this.getOptionStyle(option);
              let isSelect = selectedOptions.some(selectedOption => {
                return selectedOption.id === option.id;
              });
              const isActive = index === this.state.highlightIndex;
              return (
                <div
                  key={index}
                  className={`select-option-item ${isActive && 'active'}`}
                  ref={ref => this.selectItem = ref}
                  onMouseDown={this.onOptionItemToggle.bind(this, option)}
                >
                  <div className="option-info">
                    <div className="option-name text-truncate" style={optionStyle} title={option.name}>{option.name}</div>
                  </div>
                  <div className="option-checked">
                    {isSelect && <i className="dtable-font dtable-icon-check-mark"></i>}
                  </div>
                </div>
              );
            })}
            {options.length === 0 && (
              <div className="search-option-null">
                {gettext('No options available')}
              </div>
            )}
          </div>
        </div>
      </DTablePopover>
    );
  }
}

SelectEditorPopover.defaultProps = {
  isMultipleSelect: false,
};

SelectEditorPopover.propTypes = propTypes;

export default SelectEditorPopover;
