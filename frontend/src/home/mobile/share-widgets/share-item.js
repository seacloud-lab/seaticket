import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import SelectPermission from './select-permission';
import { Icon } from '../../../components';

const propTypes = {
  isShowImage: PropTypes.bool,
  shareName: PropTypes.string,
  options: PropTypes.array.isRequired,
  item: PropTypes.object.isRequired,
  updateProjectShare: PropTypes.func,
  deleteProjectShare: PropTypes.func,
};

class ShareItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isSelectedPermission: false,
    };
  }

  onShowSelectedPermission = () => {
    this.setState({ isSelectedPermission: !this.state.isSelectedPermission });
  };

  updateProjectShare = (permission) => {
    const { item } = this.props;
    this.props.updateProjectShare(item, permission);
  };

  deleteProjectShare = () => {
    const { item } = this.props;
    this.props.deleteProjectShare(item);
  };

  render() {
    const { item, isShowImage, shareName, options } = this.props;
    const { isSelectedPermission } = this.state;
    const optionItem = options.find(optionItem => optionItem.value === item.permission) || {};
    return (
      <Fragment>
        <div className="share-item">
          <div className="share-item-container">
            {isShowImage &&
              <span className="share-user-avatar-container">
                <img src={item.avatar_url} className="share-user-avatar" alt="" />
              </span>
            }
            <span className="share-item-name">{shareName}</span>
          </div>
          <div className="selected-permission-container" onClick={this.onShowSelectedPermission}>
            <span className="selected-permission-text">{optionItem.title || ''}</span>
            <Icon symbol="down" className="selected-permission-icon" />
          </div>
        </div>
        {isSelectedPermission &&
          <SelectPermission
            toggle={this.onShowSelectedPermission}
            setPermission={this.updateProjectShare}
            permission={item.permission}
            isShowDeleteBtn={true}
            onHandleDeleteShare={this.deleteProjectShare}
            options={options}
          />
        }
      </Fragment>
    );
  }
}

ShareItem.propTypes = propTypes;

export default ShareItem;
