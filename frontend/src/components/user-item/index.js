import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { gettext } from '../../constants';
import IconButton from '../icon-button';

import './index.css';

const propTypes = {
  user: PropTypes.object,
  className: PropTypes.string,
  enableDelete: PropTypes.bool,
  onDelete: PropTypes.func,
};

class UserItem extends React.Component {

  onDelete = (event) => {
    event.stopPropagation();
    event && event.nativeEvent.stopImmediatePropagation();
    this.props.onDelete(this.props.user);
  };

  render() {
    const { className, user, enableDelete } = this.props;
    const name = user.name || user.nickname || '';
    return (
      <div className={classnames('user-item', className)} title={name}>
        {
          user.avatar_url && (
            <span className="user-avatar">
              <img className="user-avatar-icon" alt={name} src={user.avatar_url} />
            </span>
          )
        }
        <div className="d-flex align-items-center">
          <span className="user-name">{name}</span>
        </div>
        {enableDelete && (
          <IconButton icon="x" className="user-remove ml-2 no-hover-bg" onClick={this.onDelete} title={gettext('Remove')} />
        )}
      </div>
    );
  }
}

UserItem.propTypes = propTypes;

export default UserItem;

