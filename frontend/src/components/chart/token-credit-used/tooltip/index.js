import React, { useEffect, useRef, useState } from 'react';

import './index.css';
import { gettext } from '@/constants';

const Tooltip = ({
  data,
  position: initPosition,
  legends
}) => {
  const [position, setPosition] = useState(initPosition);

  const ref = useRef(null);

  useEffect(() => {
    const { height, width } = ref.current.getBoundingClientRect();
    const { left, top } = initPosition || {};
    let position = { ...initPosition };
    if (top + height > window.innerHeight - 10) {
      position.top = 'unset';
      position.bottom = 10;
    }
    if (left + width > window.innerWidth - 10) {
      position.left = 'unset';
      position.right = 10;
    }
    setPosition(position);
  }, [initPosition]);

  return (
    <div
      className="sea-ai-tokens-chart-tooltip"
      ref={ref}
      style={position}
    >
      <div className="sea-ai-tokens-chart-tooltip-header">{data.name}</div>
      {legends.map(l => {
        if (l.key === 'credit_used') return null;
        return (
          <div className="sea-ai-tokens-chart-tooltip-item" key={l.key}>
            {`${l.name}: ${data[l.key]}`}
          </div>
        );
      })}
      <div className="sea-ai-tokens-chart-tooltip-item">
        {`${gettext('Total tokens')}: ${data.total_tokens}`}
      </div>
      <div className="sea-ai-tokens-chart-tooltip-footer">
        {`${gettext('Credit used')}: ${data.credit_used.toFixed(0)}`}
      </div>
    </div>
  );
};

export default Tooltip;
