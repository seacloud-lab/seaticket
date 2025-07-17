import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { gettext } from '../../../../constants';
import { seaQAAPI } from '../../../../api/web-api';
import BaseSharePermission from './base-share-permission';
import Loading from '../../../../components/loading';
import { IconButton } from '../../../components';

class AddSharePermission extends Component {

  constructor(props) {
    super(props);
    this.state = {
      basePermission: null,
      errMessage: '',
      isLoading: true,
    };
  }

  componentDidMount() {
    const { workspaceID, name } = this.props;
    seaQAAPI.getBaseSharePermission(workspaceID, name).then((res) => {
      const permission = res.data.base_permission;
      this.setState({ basePermission: { permission }, isLoading: false });
    });
  }

  onAddSharePermission = () => {
    const { basePermission } = this.state;
    if (!basePermission) return;
    const { name, description } = basePermission;
    let errMessage = '';
    if (!name || !name.trim()) {
      errMessage = 'Name is required';
    }
    if (!errMessage && (!description || !description.trim())) {
      errMessage = 'Description is required';
    }
    this.setState({ errMessage });
    if (errMessage) return;
    this.props.onAddSharePermission(basePermission);
  };

  updateBasePermission = (basePermission) => {
    this.setState({ basePermission });
  };

  render() {
    const { basePermission, isLoading, errMessage } = this.state;
    return (
      <div className="add-share-permission">
        <div className="add-share-permission-header d-flex align-items-center justify-content-between">
          <span>
            <IconButton icon="return" className="back-btn d-inline-flex" onClick={this.props.onChangeStatus} />
            <span className="add-share-permission-header-text">{gettext('Add permission')}</span>
          </span>
          <Button onClick={this.onAddSharePermission} type="button" color="outline-primary" size="sm" className="add-share-permission-btn">{gettext('Submit')}</Button>
        </div>
        {isLoading && <div className="share-permission-loading-tips"><Loading /></div>}
        {(!isLoading && basePermission) &&
          <BaseSharePermission
            basePermission={basePermission}
            errMessage={errMessage}
            updateBasePermission={this.updateBasePermission}
          />
        }
      </div>
    );
  }
}

AddSharePermission.propTypes = {
  workspaceID: PropTypes.number,
  name: PropTypes.string,
  onChangeStatus: PropTypes.func,
  onAddSharePermission: PropTypes.func,
};

export default AddSharePermission;
