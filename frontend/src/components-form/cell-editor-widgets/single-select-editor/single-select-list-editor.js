import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup } from 'reactstrap';
import { DTableRadio } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  value: PropTypes.string,
  column: PropTypes.object,
  row: PropTypes.object,
  columns: PropTypes.array,
  onCommit: PropTypes.func,
  updateTabIndex: PropTypes.func,
  getOptions: PropTypes.func,
};

const gettext = window.gettext;

class SingleSelectListEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    value: ''
  };

  componentDidMount() {
    document.addEventListener('keydown', this.onHotKey, true);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onHotKey, true);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (!this.props.isEditorShow && nextProps.isEditorShow && !nextProps.value) {
      const options = this.props.getOptions();
      const option = options[0];
      this.onChange(option.id);
    }
  }

  onHotKey = (e) => {
    if (!this.props.isEditorShow) return;
    if (e.keyCode === Utils.keyCodes.up) {
      e.preventDefault();
      e.stopPropagation();
      this.navigateOptions(-1);
    } else if (e.keyCode === Utils.keyCodes.down) {
      e.preventDefault();
      e.stopPropagation();
      this.navigateOptions(1);
    }
  };

  navigateOptions = (direction) => {
    const { value } = this.props;
    const validOptions = this.props.getOptions();
    const currentIndex = validOptions.findIndex(option => option.id === value);
    let newIndex = currentIndex + direction;
    if (newIndex < 0) {
      newIndex = validOptions.length - 1;
    } else if (newIndex >= validOptions.length) {
      newIndex = 0;
    }
    const newOption = validOptions[newIndex];
    this.onChange(newOption.id);
  };

  onChange = (value) => {
    let { isReadOnly, isSubmitting } = this.props;
    if (isReadOnly || isSubmitting) return;
    this.props.updateTabIndex && this.props.updateTabIndex();
    this.props.onCommit(value);
  };

  getOptionsList = () => {
    const { column, value, isReadOnly } = this.props;
    const validOptions = this.props.getOptions();
    if (validOptions.length === 0) {
      return (
        <div className="empty-options-tip">{gettext('No options available')}</div>
      );
    }

    return validOptions.map((option, index) => {
      let label = (
        <div className="option-item-content" style={{ backgroundColor: option.color }}>
          <div className="option-item-name text-truncate" style={{ color: option.textColor || null }} title={option.name}>{option.name}</div>
        </div>
      );
      return (
        <FormGroup check className="ml-1 option-list-item" key={index}>
          <DTableRadio
            name={`radio${column.key}`}
            label={label}
            onCheckedChange={() => this.onChange(option.id)}
            isChecked={value === option.id}
            disabled={isReadOnly}
          />
        </FormGroup>
      );
    });
  };

  render() {
    let { column, isSubmitting } = this.props;
    return (
      <div className={`options-list cell-editor grid-cell-type-${column.type} ${isSubmitting ? 'readOnly' : ''}`}>
        {this.getOptionsList()}
      </div>
    );
  }
}

SingleSelectListEditor.propTypes = propTypes;

export default SingleSelectListEditor;
