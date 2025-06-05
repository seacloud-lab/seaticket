import Icon from './icon';
import React from 'react';

export default function UniversalIcon(props) {
  const { className, title, symbol, color, onClick = () => {} } = props;

  if (symbol.startsWith('dtable-icon')) {
    return (
      <span
        className={`dtable-font ${symbol} ${className || ''}`}
        style={{ color }}
        onClick={onClick}
      />
    );
  }

  return (
    <Icon
      symbol={symbol}
      color={color}
      className={className}
      title={title}
      onClick={onClick}
    />
  );
}
