import React from 'react';
import PropTypes from 'prop-types';
import { DTableSwitch } from 'dtable-ui-component';
import { COLUMN_CONFIG_KEY } from '../../../constants/column';

const propTypes = {
  column: PropTypes.object,
  onColumnChanged: PropTypes.func,
};

const gettext = window.gettext;

class IsRequired extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isRequired: props.column.is_required
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { column } = this.props;
    if (nextProps.column.key !== column.key || nextProps.column.is_required !== column.is_required) {
      this.setState({
        isRequired: nextProps.column.is_required
      });
    }
  }

  onRequiredChanged = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    const value = event.target.checked;
    if (value === this.state.isRequired) return;
    const { column } = this.props;
    this.setState({ isRequired: value }, () => {
      this.props.onColumnChanged(column.key, { [COLUMN_CONFIG_KEY.IS_REQUIRED]: value });
    });
  };

  render() {
    return (
      <div className="filed-setting-item is-required">
        <DTableSwitch
          switchClassName="filed-switch d-flex"
          placeholder={gettext('Required')}
          checked={this.state.isRequired}
          onChange={this.onRequiredChanged}
        />
      </div>
    );
  }
}

IsRequired.propTypes = propTypes;

export default IsRequired;
