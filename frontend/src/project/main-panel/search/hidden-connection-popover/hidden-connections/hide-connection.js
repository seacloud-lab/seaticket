import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Switch from '../../../../../components/switch/index';

const HideConnection = ({
  readOnly,
  isHidden,
  column,
  onChange,
}) => {
  return (
    <div
      className={classNames('hide-column-item', {
        'disabled': readOnly,
      })}
    >
      <Switch
        className="hide-column-item-switch"
        disabled={readOnly}
        checked={isHidden}
        placeholder={<span className="text-truncate">{column.name}</span>}
        onChange={() => onChange(column)}
      />
    </div>
  );
};

HideConnection.propTypes = {
  readOnly: PropTypes.bool,
  isHidden: PropTypes.bool,
  column: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default HideConnection;
