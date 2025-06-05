import React from 'react';
import PropTypes from 'prop-types';
import { Button, Form, FormGroup, FormText, Input, InputGroup } from 'reactstrap';
import { DateUtils } from 'dtable-utils';
import { toaster, DTableSwitch } from 'dtable-ui-component';
import { gettext } from '../../../utils/constants';

const propTypes = {
  onDateChange: PropTypes.func.isRequired,
  onChangeDateShow: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  date: PropTypes.string,
  isDateShow: PropTypes.bool,
  dateTitle: PropTypes.string,
};

class SettingDate extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      checked: props.isDateShow,
      textValue: props.date,
    };
  }

  componentDidMount() {
    const { textValue } = this.state;
    if (!textValue) return;
    const date = DateUtils.getValidDate(textValue);
    if (date) {
      const newValue = this.formatDate(date);
      this.setState({ textValue: newValue });
    } else {
      this.setState({ textValue: '' });
    }
  }

  onChangeDateShow = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    let value = event.target.checked;
    if (value === this.state.checked) {
      return;
    }
    this.props.onChangeDateShow(value);
    this.setState({ checked: value });
  };

  handleChange = (e) => {
    this.setState({ textValue: e.target.value });
  };

  formatDate = (date) => {
    let month = '' + (date.getMonth() + 1);
    let day = '' + date.getDate();
    let year = date.getFullYear();
    month = month.padStart(2, '0');
    day = day.padStart(2, '0');
    return `${year}-${month}-${day} ${date.toTimeString().slice(0, 8)}`;
  };

  onSave = () => {
    let value = this.state.textValue.trim(); let date;
    try {
      value = value.replace(/\s+/g, ' ');
      if (value[10] !== ' ') {
        value = value.substring(0, 10) + ' ' + value.substring(10);
      }
      value = value.substring(0, 19);
      date = DateUtils.getValidDate(value);
      if (!date) {
        toaster.danger(gettext('Invalid date.'));
        return;
      }
    } catch (err) {
      toaster.danger(gettext('Invalid date.'));
      return;
    }
    value = this.formatDate(date);
    this.props.onDateChange(value);
    this.setState({ textValue: value });
  };

  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.onSave();
      e.preventDefault();
    }
  };

  render() {
    const { checked, textValue } = this.state;
    const { dateTitle } = this.props;
    return (
      <div className="table-setting form-setting-remarks">
        <DTableSwitch
          checked={checked}
          onChange={this.onChangeDateShow}
          placeholder={dateTitle}
        />
        {checked &&
          <div className="form-remark-tip">
            <Form>
              <FormGroup>
                <InputGroup>
                  <Input value={textValue} onChange={this.handleChange} onKeyDown={this.onKeyDown} />
                  <Button onClick={this.onSave}>{gettext('Save')}</Button>
                </InputGroup>
                <FormText>{gettext('Eg')}{': 2020-01-01 18:30:00.'}</FormText>
              </FormGroup>
            </Form>
          </div>
        }
      </div>
    );
  }
}

SettingDate.propTypes = propTypes;

export default SettingDate;
