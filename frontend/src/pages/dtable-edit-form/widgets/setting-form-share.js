import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup } from 'reactstrap';
import { DTableRadio } from 'dtable-ui-component';
import '../css/group-selection.css';

const gettext = window.gettext;
const propTypes = {
  handleShareTypeChange: PropTypes.func.isRequired,
  shareType: PropTypes.string.isRequired,
  allGroups: PropTypes.array.isRequired,
  selectedGroups: PropTypes.array.isRequired,
  onCommit: PropTypes.func.isRequired,
};

class SettingFormShare extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      showPopover: false,
    };
  }

  componentDidMount() {
    document.addEventListener('click', this.onDocumentToggle);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.onDocumentToggle);
  }

  onDocumentToggle = () => {
    this.setState({ showPopover: false });
  };

  changeToAnonymous = () => {
    this.props.handleShareTypeChange('anonymous');
  };

  changeToUsers = () => {
    this.props.handleShareTypeChange('login_users');
  };

  render() {
    const { shareType } = this.props;
    return (
      <div className="table-setting">
        <div className="title">{gettext('Manage permissions')}</div>
        <FormGroup check className="edit-form-permission">
          <DTableRadio
            isChecked={shareType === 'anonymous'}
            onCheckedChange={this.changeToAnonymous}
            label={gettext('Anyone (including anonymous users)')}
            name="formShare"
          />
        </FormGroup>
        <FormGroup check>
          <DTableRadio
            isChecked={shareType === 'login_users'}
            onCheckedChange={this.changeToUsers}
            label={gettext('Only login users')}
            name="formShare"
          />
        </FormGroup>
      </div>
    );
  }
}

SettingFormShare.propTypes = propTypes;

export default SettingFormShare;
