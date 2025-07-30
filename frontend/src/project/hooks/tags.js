import React, { useContext, useEffect, useState, useCallback } from 'react';
import deepCopy from 'deep-copy';
import { TicketTag } from '../models';
import { seaQAAPI } from '../../api/web-api';
import { Utils } from '../../utils/utils';
import { toaster } from '../../components';

const TagsContext = React.createContext(null);

export const TagsProvider = ({ projectUuid, tagsCount = 1, children }) => {

  const [isLoading, setLoading] = useState(true);
  const [tags, setTags] = useState([]);

  const applyCreateTags = useCallback((oldTags, newTags) => {
    if (!Array.isArray(newTags) || newTags.length === 0) return;
    const tags = deepCopy(oldTags);
    newTags.forEach(tag => {
      const newTag = tag instanceof TicketTag ? tag : new TicketTag(tag);
      tags.push(newTag);
    });
    setTags(tags);
  }, []);

  const createTag = useCallback((tag) => {
    return seaQAAPI.createProjectTag(projectUuid, tag).then(res => {
      const tag = new TicketTag(res.data.project_tag);
      applyCreateTags(tags, [tag]);
      return tag;
    });
  }, [projectUuid, tags, applyCreateTags]);

  const deleteTag = useCallback((tagID) => {
    return seaQAAPI.deleteProjectTag(projectUuid, tagID).then(res => {
      const newTags = tags.slice(0).filter(tag => tag.id !== tagID);
      setTags(newTags);
      return tagID;
    });
  }, [projectUuid, tags]);

  const modifyTag = useCallback((tagID, update) => {
    return seaQAAPI.modifyProjectTag(projectUuid, tagID, update).then(res => {
      const newTags = deepCopy(tags);
      const tagIndex = newTags.findIndex(tag => tag.id === tagID);
      if (tagIndex === -1) return;
      const tag = newTags[tagIndex];
      const newTag = tag._update(update);
      newTags[tagIndex] = newTag;
      setTags(newTags);
    });
  }, [projectUuid, tags]);

  const reLoadTags = useCallback(() => {
    setLoading(true);
    seaQAAPI.listProjectTags(projectUuid, tagsCount).then(res => {
      const tags = Array.isArray(res.data.project_tags) ? res.data.project_tags : [];
      applyCreateTags([], tags);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [projectUuid, tagsCount]);

  useEffect(() => {
    reLoadTags();
  }, []);

  return (
    <TagsContext.Provider value={{
      isLoading,
      tags,
      createTag,
      modifyTag,
      deleteTag,
    }}>
      {children}
    </TagsContext.Provider>
  );
};

export const useTags = () => {
  const context = useContext(TagsContext);
  if (!context) {
    throw new Error('\'TagsContext\' is null');
  }
  return context;
};
