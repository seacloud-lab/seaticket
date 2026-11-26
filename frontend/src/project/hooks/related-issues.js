import React, { useContext } from 'react';

export const RelatedIssuesContext = React.createContext(null);

export const useRelatedIssues = () => {
  const context = useContext(RelatedIssuesContext);
  if (!context) {
    throw new Error('\'RelatedIssuesContext\' is null');
  }
  return context;
};
