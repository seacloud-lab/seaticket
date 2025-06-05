import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import OptGroup from './option-group';
import AnyDepartmentUserSelectDialog from '../dialog/any-department-member-select-dialog';

import './index.css';
import '../../css/select/index.css';
import '../../css/collaborator-select.css';

class AnyUserSelect extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowSelectOptions: false,
      isShowDepartmentDetailDialog: false,
    };
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.onClick);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.onClick);
  }

  onSelectToggle = (event) => {
    event.preventDefault();
    /*
      if select is showing, click events do not need to be monitored by other click events,
      so it can be closed when other select is clicked.
    */
    if (this.state.isShowSelectOptions) event.nativeEvent.stopImmediatePropagation();
    let eventClassName = event.target.className;
    if (this.props.isLocked || eventClassName.indexOf('option-search-control') > -1 || eventClassName === 'option-group-search') return;
    // Prevent closing by pressing the spacebar in the search input
    if (event.target.value === '') return;
    this.setState({
      isShowSelectOptions: !this.state.isShowSelectOptions
    });
  };

  onClick = (event) => {
    if (this.props.isShowSelected && event.target.className.includes('icon-fork-number')) {
      return;
    }
    if (!this.selector.contains(event.target)) {
      this.closeSelect();
    }
  };

  closeSelect = () => {
    this.setState({ isShowSelectOptions: false });
  };

  getSelectedOptionTop = () => {
    if (!this.selector) return 38;
    const { height } = this.selector.getBoundingClientRect();
    return height;
  };

  toggleDepartmentDetailDialog = () => {
    this.setState({ isShowDepartmentDetailDialog: !this.state.isShowDepartmentDetailDialog });
  };

  addUsers = (users) => {
    this.props.onSelectOptions(users);
    this.toggleDepartmentDetailDialog();
  };

  render() {
    const { className, value, placeholder, isLocked, values, ...otherProps } = this.props;
    const { isShowSelectOptions, isShowDepartmentDetailDialog } = this.state;

    return (
      <>
        <div
          ref={(node) => this.selector = node}
          className={classnames('dtable-select custom-select collaborator-select',
            { 'focus': this.state.isShowSelectOptions },
            { 'disabled': isLocked },
            className
          )}
          onClick={this.onSelectToggle}>
          <div className="selected-option">
            {value && value.label ? (
              <span className="selected-option-show">{value.label}</span>
            ) : (
              <span className="select-placeholder">{placeholder}</span>
            )}
            {!isLocked && <i className="dtable-font dtable-icon-down3"></i>}
          </div>
          {isShowSelectOptions && (
            <OptGroup
              value={value}
              top={-3}
              left={-3}
              onToggleDepartmentDetailDialog={this.toggleDepartmentDetailDialog}
              { ...otherProps }
            />
          )}
        </div>
        {isShowDepartmentDetailDialog && (
          <AnyDepartmentUserSelectDialog
            toggleDepartmentDetailDialog={this.toggleDepartmentDetailDialog}
            addUsers={this.addUsers}
            userList={values}
          />
        )}
      </>
    );
  }
}

AnyUserSelect.propTypes = {
  isLocked: PropTypes.bool,
  supportMultipleSelect: PropTypes.bool,
  isShowSelected: PropTypes.bool,
  isLoading: PropTypes.bool,
  enableUseDeptBtn: PropTypes.bool,
  className: PropTypes.string,
  value: PropTypes.object,
  values: PropTypes.array,
  options: PropTypes.array,
  placeholder: PropTypes.string,
  noOptionsPlaceholder: PropTypes.string,
  asyncLoadOptions: PropTypes.func,
  onSelectOption: PropTypes.func,
  onSelectOptions: PropTypes.func,
};

export default AnyUserSelect;
