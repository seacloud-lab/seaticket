import React from 'react';

import './index.css';

const Legend = ({ data }) => (
  <ul className="chart-legend">
    {data.map((item, index) => (
      <li key={index}>
        <span className="chart-swatch" style={{ backgroundColor: item.color }} />
        <span>{item.name}</span>
      </li>
    ))}
  </ul>
);

export default Legend;
