/* eslint-disable react/prop-types */
import React, { useContext } from 'react';

const TagsDataContext = React.createContext(null);

export const TagsDataProvider = ({
  tagsData,
  createTag,
  toggleAllTags,
  children,
}) => {
  return (
    <TagsDataContext.Provider
      value={{
        tagsData,
        createTag,
        toggleAllTags,
      }}
    >
      {children}
    </TagsDataContext.Provider>
  );
};

export const useTagsData = () => {
  const context = useContext(TagsDataContext);
  if (!context) {
    throw new Error('\'TagsDataContext\' is null');
  }
  return context;
};
