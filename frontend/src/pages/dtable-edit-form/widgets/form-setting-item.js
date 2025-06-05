import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { COLUMNS_ICON_CONFIG } from 'dtable-utils';
import { DTableSwitch } from 'dtable-ui-component';

const propTypes = {
  column: PropTypes.object.isRequired,
  onColumnItemClick: PropTypes.func.isRequired,
};

class FormSettingItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      checked: props.column.editable
    };
  }

  onColumnItemClick = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    let value = event.target.checked;
    if (value === this.state.checked) {
      return;
    }
    let { column } = this.props;
    this.setState({ checked: value }, () => {
      this.props.onColumnItemClick(column.key, !column.editable);
    });
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.column.editable !== this.props.column.editable) {
      this.setState({ checked: nextProps.column.editable });
    }
  }

  render() {
    let { column } = this.props;
    let placeholder = <Fragment><i className={COLUMNS_ICON_CONFIG[column.type]}></i><span>{column.name}</span></Fragment>;
    return (
      <DTableSwitch
        checked={this.state.checked}
        placeholder={placeholder}
        onChange={this.onColumnItemClick}
        switchClassName="form-setting-item"
      />
    );
  }
}

FormSettingItem.propTypes = propTypes;

export default FormSettingItem;
