import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Switch from '../../../../../components/switch/index';

const HideConnection = ({
  readOnly,
  isHidden,
  connection,
  onChange,
}) => {
  return (
    <div
      className={classNames('hide-column-item border-radius-4', {
        'disabled': readOnly,
      })}
    >
      <Switch
        className="hide-column-item-switch"
        disabled={readOnly}
        checked={isHidden}
        placeholder={<span className="text-truncate">{connection.name}</span>}
        onChange={() => onChange(connection)}
      />
    </div>
  );
};

HideConnection.propTypes = {
  readOnly: PropTypes.bool,
  isHidden: PropTypes.bool,
  connection: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default HideConnection;
