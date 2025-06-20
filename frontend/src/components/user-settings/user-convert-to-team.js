import React from 'react';
import { gettext } from '../../constants';
import ModalPortal from '../modal-portal';
import ConfirmUserConvertToTeam from '../dialog/confirm-user-convert-to-team';

class UserConvertToTeam extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isConfirmDialogOpen: false
    };
  }

  confirm = (e) => {
    e.preventDefault();
    this.setState({
      isConfirmDialogOpen: true
    });
  };

  toggleDialog = () => {
    this.setState({
      isConfirmDialogOpen: !this.state.isConfirmDialogOpen
    });
  };

  render() {
    return (
      <React.Fragment>
        <div className="setting-item" id="convert">
          <h3 className="setting-item-heading">{gettext('Convert to team account')}</h3>
          <p className="mb-2">{gettext('This operation will not be reverted. Please think twice!')}</p>
          <button className="btn btn-outline-primary" onClick={this.confirm}>{gettext('Confirm')}</button>
        </div>
        {this.state.isConfirmDialogOpen && (
          <ModalPortal>
            <ConfirmUserConvertToTeam
              toggle={this.toggleDialog}
            />
          </ModalPortal>
        )}
      </React.Fragment>
    );
  }
}

export default UserConvertToTeam;
