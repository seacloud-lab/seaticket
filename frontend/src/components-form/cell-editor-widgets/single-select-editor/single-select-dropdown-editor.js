import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import classnames from 'classnames';
import SingleSelectView from '../../cell-viewer-mobile/single-select-view';
import SelectEditorPopover from '../select-editor-popover';
import SelectEditorOption from '../select-editor-option';
import { Utils } from '../../../utils/utils';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  value: PropTypes.string,
  column: PropTypes.object,
  onCommit: PropTypes.func,
  isEditorShow: PropTypes.bool,
  updateTabIndex: PropTypes.func,
  getOptions: PropTypes.func,
};

const gettext = window.gettext;

class SingleSelectDropdownEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    value: ''
  };

  constructor(props) {
    super(props);
    this.state = {
      isPopoverShow: props.isEditorShow || false,
    };
    this.isEditorMounted = true;
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

  formatOption = () => {
    let { column, value } = this.props;
    if (!value) {
      return null;
    }
    let options = (column && column.data && column.data.options) || [];
    let option = options.find(option => option.id === value);
    return option;
  };

  onAddOptionToggle = () => {
    if (this.props.isReadOnly || this.props.isSubmitting) {
      return;
    }
    this.setState({ isPopoverShow: !this.state.isPopoverShow }, () => {
      if (this.props.updateTabIndex) {
        this.props.updateTabIndex();
      }
    });
  };

  onOptionItemToggle = (option) => {
    let { value } = this.props;
    this.setState({ isPopoverShow: false }, () => {
      if (value === option.id) {
        this.props.onCommit('');
      } else {
        this.props.onCommit(option.id);
      }
    });
  };

  setEditorRef = (editor) => {
    this.editor = editor;
  };

  render() {
    const { isSubmitting, column, isReadOnly, isEditorShow, isRequired } = this.props;
    let { isPopoverShow } = this.state;
    let option = this.formatOption();
    let options = this.props.getOptions();
    let selectedOptions = option ? [option] : [];
    const target = `form-grid-cell-type-single-select-${column.key}`;
    return (
      <Fragment>
        <MediaQuery query="(min-width: 768px)">
          <div
            id={target}
            className={classnames('form-single-select-container custom-select', { 'focus': isEditorShow }, { 'disable': isReadOnly })}
            onClick={this.onAddOptionToggle}
            ref={this.editorContainer}
            aria-label={isRequired ? column.name + ', ' + gettext('Required') : column.name}
            tabIndex={0}
          >
            <div className="single-select-inner">
              <div className="select-editor-container" ref={this.setEditorRef}>
                {option && <SelectEditorOption option={option} className="m-0"/>}
              </div>
              {isPopoverShow &&
                <SelectEditorPopover
                  options={options}
                  target={target}
                  selectedOptions={selectedOptions}
                  onOptionItemToggle={this.onOptionItemToggle}
                  onSelectEditorPopoverToggle={this.onAddOptionToggle}
                />
              }
              <i className="dtable-font dtable-icon-down3"></i>
            </div>
          </div>
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          <div
            className={`cell-editor grid-cell-type-single-select ${isSubmitting ? 'readOnly' : ''}`}
            onClick={this.onAddOptionToggle}
            ref={this.editorContainer}
            aria-label={isRequired ? column.name + ', ' + gettext('Required') : column.name}
            tabIndex={0}
          >
            <div ref={this.setEditorRef} className="select-editor-container">
              {option && <SelectEditorOption option={option} />}
            </div>
            {!option && <div className="select-editor-add" onClick={this.onAddOptionToggle}>{gettext('Choose option')}</div>}
            {isPopoverShow &&
              <SingleSelectView
                column={this.props.column}
                options={options}
                value={this.props.value}
                onCommit={this.onOptionItemToggle}
                closeEditor={this.onAddOptionToggle}
              />
            }
          </div>
        </MediaQuery>
      </Fragment>
    );
  }
}

SingleSelectDropdownEditor.propTypes = propTypes;

export default SingleSelectDropdownEditor;
