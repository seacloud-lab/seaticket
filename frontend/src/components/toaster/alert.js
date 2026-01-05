import React from 'react';
import PropTypes from 'prop-types';
import Icon from '../icon';

const propTypes = {
  intent: PropTypes.string.isRequired,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  onRemove: PropTypes.func.isRequired,
  children: PropTypes.string,
  isRemovable: PropTypes.bool,
};

class Alert extends React.PureComponent {

  getIconSymbol(intent) {
    switch (intent) {
      case 'success':
        return 'check-circle';
      case 'warning':
        return 'exclamation-triangle-filled';
      case 'none':
      case 'danger':
        return 'exclamation-circle-filled';
      default:
        return 'check-circle';
    }
  }

  render() {
    const { intent, title, children, isRemovable, onRemove } = this.props;
    const symbol = this.getIconSymbol(intent);
    return (
      <div className={`sea-qa-toast-alert-container ${intent || 'success'}`}>
        <div className="toast-alert-icon">
          <Icon symbol={symbol} />
        </div>
        <div className="toast-text-container">
          <p className="toast-text-title">{title}</p>
          {children ? <p className="toast-text-child">{children}</p> : null}
        </div>
        {isRemovable && (
          <div onClick={onRemove} className="toast-close">
            <span>&times;</span>
          </div>
        )}
      </div>
    );
  }
}

Alert.propTypes = propTypes;

export default Alert;
