import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import classnames from 'classnames';
import MultipSelectView from '../../cell-viewer-mobile/multi-select-view';
import SelectEditorPopover from '../select-editor-popover';
import SelectEditorOption from '../select-editor-option';
import { Utils } from '../../../utils/utils';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  column: PropTypes.object,
  onCommit: PropTypes.func,
  isEditorShow: PropTypes.bool,
  updateTabIndex: PropTypes.func,
};

const gettext = window.gettext;

class MultipleSelectDropdownEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    value: []
  };

  constructor(props) {
    super(props);
    this.state = {
      newValue: this.getNewValue(props.value),
      isPopoverShow: props.isEditorShow || false,
    };
    this.isEditorMounted = false;
    this.editorContainer = React.createRef();
  }

  componentDidMount() {
    this.isEditorMounted = true;
    document.addEventListener('keydown', this.onHotKey);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onHotKey);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isEditorShow !== this.props.isEditorShow) {
      this.setState({ isPopoverShow: nextProps.isEditorShow });
    }
  }

  onHotKey = (e) => {
    if (e.keyCode === Utils.keyCodes.enter && this.props.isEditorShow && !this.state.isPopoverShow) {
      this.setState({ isPopoverShow: true });
    }
  };

  getNewValue = (value) => {
    if (value) {
      if (typeof value === 'string') {
        return [value];
      } else if (Array.isArray(value) && value.length > 0) {
        return value.slice();
      }
    }
    return [];
  };

  onClickOutside = (e) => {
    if (this.state.isPopoverShow && !this.editorContainer.current.contains(e.target)) {
      this.setState({ isPopoverShow: false });
    }
  };

  onAddOptionToggle = () => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    this.setState({ isPopoverShow: !this.state.isPopoverShow }, () => {
      if (this.props.updateTabIndex) {
        this.props.updateTabIndex();
      }
    });
  };

  getOptionNameById = (optionID) => {
    let options = this.props.column.data && this.props.column.data.options;
    if (!optionID || !options) {
      return '';
    }
    let option = options && options.find(option => option.id === optionID);
    return option ? option.name : '';
  };

  onCommit = (option_ids) => {
    this.props.onCommit(option_ids);
  };

  onDeleteSelectOption = (option) => {
    if (this.props.isSubmitting) return;
    let { newValue: currentValue } = this.state;
    let newValue = currentValue.filter(item => item !== option.id);
    this.setState({ newValue: newValue }, () => {
      this.onCommit(newValue);
    });
  };

  onOptionItemToggle = (option) => {
    let { newValue: currentValue } = this.state;
    // make a copy
    let newValue = (currentValue && currentValue.length > 0) ? currentValue.slice(0) : [];
    let option_index = newValue.indexOf(option.id);
    if (option_index > -1) {
      newValue.splice(option_index, 1);
    } else {
      newValue.push(option.id);
    }
    this.setState({ newValue: newValue }, () => {
      this.onCommit(newValue);
    });
  };

  formatOptions = () => {
    let { newValue } = this.state;
    let { column } = this.props;
    let options = (column && column.data && column.data.options) || [];
    if (!newValue || !newValue.length === 0) {
      return [];
    }
    let selectedOptions = options.filter(option => {
      return newValue.indexOf(option.id) > -1;
    });
    return selectedOptions;
  };

  setEditorRef = (editor) => {
    this.editor = editor;
  };

  updateValue = (newValue) => {
    this.setState({ newValue }, () => {
      this.onCommit(newValue);
    });
  };

  renderPCValueDom = (selectedOptions) => {
    const { isReadOnly, isEditorShow, isRequired, column } = this.props;
    return (
      <div
        className={classnames('form-single-select-container custom-select cell-editor', { 'focus': isEditorShow }, { 'disable': isReadOnly })}
        onClick={this.onAddOptionToggle}
        aria-label={isRequired ? column.name + ', ' + gettext('Required') : column.name}
        tabIndex={0}
      >
        <div className="single-select-inner">
          <div className="select-editor-container">
            {selectedOptions.map((option) => {
              return (
                <SelectEditorOption
                  key={option.id}
                  option={option}
                  isShowRemoveIcon={!isReadOnly}
                  onDeleteSelectOption={this.onDeleteSelectOption.bind(this, option)}
                />
              );
            })}
          </div>
          <i className="dtable-font dtable-icon-down3"></i>
        </div>
      </div>
    );
  };

  renderMobileValueDom = (selectedOptions) => {
    if (selectedOptions.length === 0) {
      return (
        <Fragment>
          <div ref={this.setEditorRef} className="select-editor-container"></div>
          <div className="select-editor-add">{gettext('Choose option')}</div>
        </Fragment>
      );
    }
    return (
      <div ref={this.setEditorRef} className="select-editor-container">
        {selectedOptions.map((option) => {
          return (
            <SelectEditorOption
              key={option.id}
              option={option}
              isShowRemoveIcon={!this.props.isReadOnly}
              onDeleteSelectOption={this.onDeleteSelectOption.bind(this, option)}
            />
          );
        })}
      </div>
    );
  };

  render() {
    let { column } = this.props;
    let selectedOptions = this.formatOptions();
    let options = column.data && column.data.options ? column.data.options : [];
    let { isPopoverShow } = this.state;
    const target = `grid-cell-type-multiple-select-${column.key}`;
    return (
      <Fragment>
        <MediaQuery query="(min-width: 768px)">
          <div
            className="position-relative w-100 grid-cell-type-multiple-select"
            id={target}
            ref={this.editorContainer}
            onClick={this.onAddOptionToggle}
          >
            {this.renderPCValueDom(selectedOptions)}
            {isPopoverShow &&
              <SelectEditorPopover
                target={target}
                options={options}
                isMultipleSelect={true}
                selectedOptions={selectedOptions}
                onOptionItemToggle={this.onOptionItemToggle}
                onSelectEditorPopoverToggle={this.onAddOptionToggle}
              />
            }
          </div>
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          <div className="cell-editor grid-cell-type-single-select" onClick={this.onAddOptionToggle} ref={this.editorContainer}>
            {this.renderMobileValueDom(selectedOptions)}
            {isPopoverShow &&
              <MultipSelectView
                column={this.props.column}
                value={this.state.newValue}
                onCommit={this.updateValue}
                closeEditor={this.onAddOptionToggle}
              />
            }
          </div>
        </MediaQuery>
      </Fragment>
    );
  }
}

MultipleSelectDropdownEditor.propTypes = propTypes;

export default MultipleSelectDropdownEditor;
