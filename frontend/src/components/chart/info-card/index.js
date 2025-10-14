import React from 'react';

import './index.css';

const InfoCard = ({
  url,
  name,
  description,
}) => {
  return (
    <div className="info-card h-100 d-inline-flex">
      {url && (<img alt='' src={url} />)}
      <div className="info-card-name text-truncate">
        <p className="mb-1">{name}</p>
        <span>{description}</span>
      </div>
    </div>
  );
};

export default InfoCard;
