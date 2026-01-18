import React from 'react';

import './inbox-count.css';

const InboxCount = ({ unseen }) => {
  const displayCount = unseen > 99 ? '99+' : unseen;

  return (
    <>
      {displayCount !== 0 && (
        <div className="inbox-count">
          {displayCount}
        </div>
      )}
    </>
  );
};

export default InboxCount;
