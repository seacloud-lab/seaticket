import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Input } from 'reactstrap';
import isHotkey from 'is-hotkey';
import { DTableSwitch } from 'dtable-ui-component';

const gettext = window.gettext;

export default class LinkButtonName extends Component {

  static propTypes = {
    column: PropTypes.object.isRequired,
    onColumnChanged: PropTypes.func.isRequired,
    columnKey: PropTypes.string.isRequired,
    switchKey: PropTypes.string.isRequired,
  };

  constructor(props) {
    super(props);
    const { column, columnKey } = this.props;
    this.state = {
      name: column[columnKey] || '',
    };
    this.nameRef = React.createRef();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { column, columnKey } = nextProps;
    this.setState({
      name: column[columnKey] || '',
    });
  }

  onKeyDown = (e) => {
    if (isHotkey('enter', e)) {
      this.nameRef.current.blur();
    }
  };

  onChange = (e) => {
    this.setState({ name: e.target.value });
  };

  saveButtonName = () => {
    const { column, columnKey } = this.props;
    let newName = this.state.name.trim();
    if (newName !== column[columnKey]) {
      let update = {};
      update[columnKey] = newName;
      this.props.onColumnChanged(column.key, update);
    }
  };

  onSwitchChange = () => {
    const { column, switchKey } = this.props;
    let update = {};
    update[switchKey] = !column[switchKey];
    this.props.onColumnChanged(column.key, update);
  };

  render() {
    const { column, switchKey } = this.props;
    return (
      <>
        <div className="filed-setting-item ml-2">
          <DTableSwitch
            switchClassName='field-switch'
            placeholder={gettext('Customize button name')}
            checked={column[switchKey] || false}
            onChange={this.onSwitchChange}
          />
        </div>
        {column[switchKey] &&
          <div className="filed-setting-item ml-2">
            <div className='filed-label'>
              <div>{gettext('Button name')}</div>
            </div>
            <Input
              className="form-control"
              value={this.state.name}
              onChange={this.onChange}
              onBlur={this.saveButtonName}
              onKeyDown={this.onKeyDown}
              innerRef={this.nameRef}
            />
          </div>
        }
      </>
    );
  }
}
