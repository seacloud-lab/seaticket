import React from 'react';
import IconButton from './icon-button';

const RemoveButton = ({
  size = { btn: 14, icon: 10 },
  style,
  iconStyle,
  callback,
}) => {
  return (
    <IconButton
      icon="close"
      style={style}
      iconStyle={iconStyle}
      className="cursor-pointer no-hover-bg"
      size={size}
      onClick={callback}
    />
  );
};

export default RemoveButton;
