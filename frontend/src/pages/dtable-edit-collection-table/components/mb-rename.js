import React from 'react';
import PropTypes from 'prop-types';
import { InputItem } from 'antd-mobile';
import { toaster } from 'dtable-ui-component';
import MobileCommonHeader from '../../dtable/mobile/mobile-common-header';
import { gettext } from '../../../utils/constants';

const propTypes = {
  currentName: PropTypes.string,
  onUpdateCurrentName: PropTypes.func.isRequired,
  onRenameCollectionNameToggle: PropTypes.func.isRequired,
};

class Rename extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isRenaming: false,
      value: props.currentName,
    };
  }

  componentDidMount() {
    history.pushState(null, null, '#');
    this.autoFocusInst.focus();
    window.addEventListener('popstate', this.handleHistoryBack, false);
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.handleHistoryBack, false);
  }

  onSave = () => {
    let { value } = this.state;
    value = value.trim();
    if (!value) {
      toaster.danger(gettext('Name is required'));
      return;
    }
    if (value === this.props.currentName) {
      this.props.onRenameCollectionNameToggle();
      return;
    }
    this.props.onUpdateCurrentName(value);
    this.props.onRenameCollectionNameToggle();
  };

  handleHistoryBack = (evt) => {
    evt.preventDefault();
    this.props.onRenameCollectionNameToggle();
  };

  onChange = (value) => {
    this.setState({ value });
  };

  onClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  render() {
    return (
      <div className="mobile-rename-collection-container">
        <MobileCommonHeader
          title={gettext('Rename collection table')}
          onLeftClick={this.props.onRenameCollectionNameToggle}
          leftName={gettext('Cancel')}
          onRightClick={this.onSave}
          rightName={gettext('Done')}
        />
        <div className="mt-5" >
          <InputItem
            type='text'
            placeholder={this.state.value ? '' : gettext('Please input')}
            value={this.state.value}
            onChange={this.onChange}
            ref={el => this.autoFocusInst = el}
            onClick={this.onClick}
          >
          </InputItem>
        </div>
      </div>
    );
  }
}

Rename.propTypes = propTypes;

export default Rename;
