import React, { Component } from 'react';
import PropTypes from 'prop-types';
import SelectOption from '../common/select-option';
import Loading from '../../../components/loading';

const gettext = window.gettext;

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
    this.resetMenuStyle();
  }

  componentWillUnmount() {
    window.removeEventListener('click', this.onClick, true);
  }

  resetMenuStyle = () => {
    const { top, height } = this.optionGroupRef.getBoundingClientRect();
    if (height + top > window.innerHeight) {
      const borderWidth = 2;
      this.optionGroupRef.style.top = -1 * (height + borderWidth) + 'px';
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
      this.setState({ searchVal: value, activeIndex: -1 }, () => {
        this.changeIndex(-1);
        this.props.asyncLoadOptions(value);
      });
    }
  };

  renderOptGroup = () => {
    const { options, noOptionsPlaceholder, isLoading, supportMultipleSelect } = this.props;
    if (isLoading) {
      return (
        <div className="none-search-result">
          <Loading />
        </div>
      );
    }
    if (options.length === 0) {
      return (
        <div className="none-search-result">
          {noOptionsPlaceholder}
        </div>
      );
    }
    return options.map((opt, i) => {
      let isActive = this.state.activeIndex === i;
      return (
        <SelectOption
          key={`user-option-${i}`}
          index={i}
          isActive={isActive}
          value={opt.value}
          onSelectOption={this.props.onSelectOption}
          changeIndex={this.changeIndex}
          supportMultipleSelect={supportMultipleSelect}
        >
          {opt.label}
        </SelectOption>
      );
    });
  };

  render() {
    const { top, left, minWidth, value, enableUseDeptBtn } = this.props;
    const { searchVal } = this.state;
    let style = { top: top || 0, left: left || 0 };
    if (minWidth) {
      style = { top: top || 0, left: left || 0, minWidth };
    }
    return (
      <div
        className="option-group pt-0"
        ref={(ref) => this.optionGroupRef = ref}
        style={style}
      >
        <div className="editor-list-delete mb-2" onClick={(e) => e.stopPropagation()}>
          {value.label || ''}
        </div>
        <div className="option-group-search position-relative">
          <input
            className="form-control option-search-control"
            type="text"
            placeholder={gettext('Search User')}
            value={searchVal}
            onChange={this.onChangeSearch}
            autoFocus
          />
          {enableUseDeptBtn && (
            <div
              className="option-group-use-dept position-absolute"
              onClick={this.props.onToggleDepartmentDetailDialog}
            >
              <i className="dtable-font dtable-icon-add_members"></i>
            </div>
          )}
        </div>
        <div className="option-group-content any-user-select-option-group-content">
          {this.renderOptGroup()}
        </div>
      </div>
    );
  }
}

OptGroup.propTypes = {
  enableUseDeptBtn: PropTypes.bool,
  stopClickEvent: PropTypes.bool,
  supportMultipleSelect: PropTypes.bool,
  isLoading: PropTypes.bool,
  top: PropTypes.number,
  left: PropTypes.number,
  minWidth: PropTypes.number,
  options: PropTypes.array,
  noOptionsPlaceholder: PropTypes.string,
  value: PropTypes.object,
  onSelectOption: PropTypes.func,
  asyncLoadOptions: PropTypes.func,
  onToggleDepartmentDetailDialog: PropTypes.func,
};

export default OptGroup;
