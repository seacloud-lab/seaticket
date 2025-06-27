import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import SelectPermission from './select-permission';

const propTypes = {
  isShowImage: PropTypes.bool,
  shareName: PropTypes.string,
  options: PropTypes.array.isRequired,
  item: PropTypes.object.isRequired,
  updateTableShare: PropTypes.func,
  deleteTableShare: PropTypes.func,
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

  updateTableShare = (permission) => {
    const { item } = this.props;
    this.props.updateTableShare(item, permission);
  };

  deleteTableShare = () => {
    const { item } = this.props;
    this.props.deleteTableShare(item);
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
            <span className="dtable-font dtable-icon-down3 selected-permission-icon"></span>
          </div>
        </div>
        {isSelectedPermission &&
          <SelectPermission
            toggle={this.onShowSelectedPermission}
            setPermission={this.updateTableShare}
            permission={item.permission}
            isShowDeleteBtn={true}
            onHandleDeleteShare={this.deleteTableShare}
            options={options}
          />
        }
      </Fragment>
    );
  }
}

ShareItem.propTypes = propTypes;

export default ShareItem;
