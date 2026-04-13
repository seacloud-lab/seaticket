import React, { useState, useEffect, useRef } from 'react';
import './index.css';

const ToolTip = ({ tooltipData, toolTipPosition, chart }) => {
  const tooltipRef = useRef(null);
  const [position, setPosition] = useState({ offsetX: -9999, offsetY: -9999 });
  const { title, items, titleMarkColor } = tooltipData || { title: '', items: [] };

  useEffect(() => {
    if (!toolTipPosition || !chart || !tooltipRef.current) {
      setPosition({ offsetX: -9999, offsetY: -9999 });
      return;
    }

    const chartRect = chart.node().getBoundingClientRect();
    const width = chartRect.width;
    const height = chartRect.height;
    const { height: tooltipHeight, width: tooltipWidth } = tooltipRef.current.getBoundingClientRect();
    const { offsetX, offsetY } = toolTipPosition;
    const distance = 16;
    const edgePadding = 8;

    let translateX = offsetX + distance;
    let translateY = offsetY;

    if (translateX + tooltipWidth + edgePadding > width) {
      translateX = offsetX - distance - tooltipWidth;
    }

    if (translateY + tooltipHeight + edgePadding > height) {
      translateY = height - tooltipHeight - edgePadding;
    }

    if (translateY < edgePadding) {
      translateY = edgePadding;
    }

    if (translateX < edgePadding) {
      translateX = edgePadding;
    }

    setPosition({ offsetX: translateX, offsetY: translateY });
  }, [chart, toolTipPosition]);

  return (
    <div ref={tooltipRef} className='sea-chart-d3-tooltip-container' style={{ transform: `translate(${position.offsetX}px, ${position.offsetY}px)`, display: position.offsetX === -9999 ? 'none' : 'block' }}>
      {title && (
        <div className="sea-chart-d3-tooltip-title">
          {titleMarkColor && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: titleMarkColor, display: 'inline-block', marginRight: '12px' }} />}
          {title}
        </div>
      )}
      <ul className="sea-chart-d3-tooltip-list">
        {items.map((item, index) => {
          return (
            <li className="sea-chart-d3-tooltip-list-item" key={index}>
              {item.color && <span className="sea-chart-d3-tooltip-marker" style={{ backgroundColor: item.color }}></span>}
              <span className="sea-chart-d3-tooltip-name">{item.name}</span>
              <span className="sea-chart-d3-tooltip-value">{item.value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ToolTip;
