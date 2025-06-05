import React from 'react';
import PropTypes from 'prop-types';
import { Input, FormText } from 'reactstrap';
import classnames from 'classnames';
import { DTableSwitch } from 'dtable-ui-component';

const propTypes = {
  onRemarkChange: PropTypes.func.isRequired,
  onChangeRemarkShow: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  remarkContent: PropTypes.string,
  isRemarkContentShow: PropTypes.bool,
  remarkTitle: PropTypes.string,
  remarkTip: PropTypes.string,
  type: PropTypes.string, // input type, default: textarea
  bottomTip: PropTypes.string,
};

class SettingRemarks extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      checked: props.isRemarkContentShow,
      textValue: props.remarkContent,
    };
  }

  onChangeRemarkShow = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    let value = event.target.checked;
    if (value === this.state.checked) {
      return;
    }
    this.props.onChangeRemarkShow(value);
    this.setState({ checked: value });
  };

  handleChange = (e) => {
    const value = e.target.value;
    this.props.onRemarkChange(value);
    this.setState({ textValue: value });
  };

  onBlur = () => {
    this.props.onSave();
  };

  render() {
    const { checked, textValue } = this.state;
    const { remarkTitle, remarkTip, type, bottomTip } = this.props;
    return (
      <div className="table-setting form-setting-remarks">
        <DTableSwitch
          checked={checked}
          onChange={this.onChangeRemarkShow}
          placeholder={remarkTitle}
        />
        {checked &&
          <div className="form-remark-tip">
            <Input
              type={type}
              value={textValue || ''}
              onChange={this.handleChange}
              placeholder={remarkTip}
              className={classnames('remark-tip-content', { 'text-remark-tip-content': type === 'text' })}
              onBlur={this.onBlur}
            />
            {bottomTip && <FormText>{bottomTip}</FormText>}
          </div>
        }
      </div>
    );
  }
}

SettingRemarks.propTypes = propTypes;

SettingRemarks.defaultProps = {
  type: 'textarea'
};

export default SettingRemarks;
