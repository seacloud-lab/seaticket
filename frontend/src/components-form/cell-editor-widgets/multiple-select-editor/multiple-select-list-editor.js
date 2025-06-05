import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label } from 'reactstrap';
import MediaQuery from 'react-responsive';
import CheckboxView from '../../../components/checkbox-view';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  value: PropTypes.array,
  column: PropTypes.object,
  onCommit: PropTypes.func,
  updateTabIndex: PropTypes.func,
};

class MultipleSelectListEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    value: []
  };

  constructor(props) {
    super(props);
    this.state = {
      value: props.value || [],
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (!Array.isArray(nextProps.value) || !this.isEqual(nextProps.value, this.props.value)) {
      this.setState({ newValue: [] });
    }
  }

  isEqual = (arr1, arr2) => {
    if (!Array.isArray(arr1) || !Array.isArray(arr2) || arr1.length !== arr2.length) return false;
    for (let i = 0, max = arr1.length; i < max; i++) {
      if (arr1[i] !== arr2[i]) {
        return false;
      }
    }
    return true;
  };

  onChange = (optionId) => {
    let { isReadOnly, isSubmitting } = this.props;
    if (isReadOnly || isSubmitting) return;
    let { value } = this.state;
    let newValue = value.slice(0);
    let optionIndex = newValue.findIndex(item => item === optionId);
    if (optionIndex > -1) {
      newValue.splice(optionIndex, 1);
    } else {
      newValue.push(optionId);
    }
    this.setState({ value: newValue }, () => {
      this.props.updateTabIndex && this.props.updateTabIndex();
      this.props.onCommit(newValue);
      this.props.updateTabIndex && this.props.updateTabIndex();
    });
  };

  renderOptionsList = () => {
    let { column, isReadOnly } = this.props;
    let { value } = this.state;
    let options = column.data && column.data.options ? column.data.options : [];
    return options.map((option, index) => {
      return (
        <FormGroup check className="ml-1 option-list-item" key={index}>
          <Label check className="option-item-label">
            <input
              type="checkbox"
              className="multiple-select-checkbox"
              onChange={() => this.onChange(option.id)}
              checked={value.includes(option.id)}
              disabled={isReadOnly}
            />
            {' '}
            <div className="option-item-content" style={{ backgroundColor: option.color }}>
              <div className="option-item-name text-truncate" style={{ color: option.textColor || null }} title={option.name}>{option.name}</div>
            </div>
          </Label>
        </FormGroup>
      );
    });
  };

  renderMobileOptionsList = () => {
    let { column, isReadOnly } = this.props;
    let { value } = this.state;
    let options = column.data && column.data.options ? column.data.options : [];
    return options.map((option, index) => {
      return (
        <FormGroup check className="ml-1 option-list-item" key={index}>
          <CheckboxView
            labelClassName="option-item-label mobile-option-item-label position-relative"
            inputClassName="multiple-select-checkbox"
            checked={value.includes(option.id)}
            disabled={isReadOnly}
            onCheckedChange={() => this.onChange(option.id)}
          >
            {' '}
            <div className="option-item-content" style={{ backgroundColor: option.color }}>
              <div className="option-item-name" style={{ color: option.textColor || null }} title={option.name}>{option.name}</div>
            </div>
          </CheckboxView>
        </FormGroup>
      );
    });
  };

  render() {
    let { column } = this.props;
    return (
      <div className={`options-list cell-editor grid-cell-type-${column.type}`}>
        <MediaQuery query="(min-width: 767.8px)">
          {this.renderOptionsList()}
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          {this.renderMobileOptionsList()}
        </MediaQuery>
      </div>
    );
  }
}

MultipleSelectListEditor.propTypes = propTypes;

export default MultipleSelectListEditor;
