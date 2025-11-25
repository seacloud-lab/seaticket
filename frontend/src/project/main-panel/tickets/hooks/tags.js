import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import deepCopy from 'deep-copy';
import { Utils } from '@/utils/utils';
import { toaster } from '@/components';
import { TagsData, Tag } from '../models';
import { ticketsAPI } from '../../../api';

const TagsContext = React.createContext(null);

export const TagsProvider = ({ projectUuid, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [tagsData, setTagsData] = useState(new TagsData());
  const [isReLoading, setReLoading] = useState(false);

  const loadTime = useRef(new Date());

  const applyCreateTags = useCallback((newTags, isReload = false) => {
    if (!Array.isArray(newTags) || newTags.length === 0) return;
    let newData = isReload ? new TagsData() : deepCopy(tagsData);
    newTags.forEach(tag => {
      const newTag = tag instanceof Tag ? tag : new Tag(tag);
      newData.rows.push(newTag);
      newData.row_ids.push(newTag._id);
      newData.id_row_map[newTag._id] = newTag;
    });
    setTagsData(newData);
  }, [tagsData]);

  const applyDeleteTags = useCallback((tagIDs) => {
    if (!Array.isArray(tagIDs) || tagIDs.length === 0) return;
    let newData = deepCopy(tagsData);
    newData.rows = newData.rows.filter(r => !tagIDs.includes(r._id));
    newData.row_ids = newData.row_ids.filter(r => !tagIDs.includes(r));
    tagIDs.forEach(tagID => {
      if (newData.id_row_map[tagID]) {
        delete newData.id_row_map[tagID];
      }
    });
    setTagsData(newData);
  }, [tagsData]);

  const applyModifyTags = useCallback((update = {}) => {
    if (Object.keys(update).length === 0) return;
    let newData = deepCopy(tagsData);
    Object.keys(update).forEach(tagID => {
      const rowIndex = newData.row_ids.findIndex(rID => rID === tagID);
      if (rowIndex > -1) {
        let newRow = newData.id_row_map[tagID];
        newRow = newRow._update(update[tagID]);
        newData.rows[rowIndex] = newRow;
        newData.id_row_map[tagID] = newRow;
      }
    });
    setTagsData(newData);
  }, [tagsData]);

  const createTag = useCallback((tag) => {
    return ticketsAPI.createTicketTag(projectUuid, tag).then(res => {
      const tag = new Tag(res.data.tag);
      applyCreateTags([tag]);
      return tag;
    });
  }, [projectUuid, applyCreateTags]);

  const deleteTag = useCallback((tagID) => {
    return ticketsAPI.deleteTicketTag(projectUuid, tagID).then(res => {
      applyDeleteTags([tagID]);
      return tagID;
    });
  }, [projectUuid, applyDeleteTags]);

  const deleteTags = useCallback((tagIDs) => {
    return ticketsAPI.deleteTicketTags(projectUuid, tagIDs).then(res => {
      applyDeleteTags(tagIDs);
      return {
        data: {
          success: tagIDs,
          failed: [],
        }
      };
    });
  }, [projectUuid, applyDeleteTags]);

  const modifyTag = useCallback((tagID, update) => {
    return ticketsAPI.modifyTicketTag(projectUuid, tagID, update).then(res => {
      applyModifyTags({ [tagID]: update });
    });
  }, [projectUuid, applyModifyTags]);

  const reload = useCallback(() => {
    const currentTime = new Date();
    if (dayjs(currentTime).diff(loadTime.current, 'hours') < 1) return;
    loadTime.current = currentTime;
    setReLoading(true);
    ticketsAPI.listTicketTags(projectUuid).then(res => {
      const tags = Array.isArray(res.data.tags) ? res.data.tags : [];
      applyCreateTags(tags, true);
      setReLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setReLoading(false);
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    ticketsAPI.listTicketTags(projectUuid).then(res => {
      const tags = Array.isArray(res.data.tags) ? res.data.tags : [];
      applyCreateTags(tags);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, [projectUuid]);

  useEffect(() => {
    load();
  }, []);

  return (
    <TagsContext.Provider value={{
      isLoading,
      isReLoading,
      tagsData,
      createTag,
      modifyTag,
      deleteTag,
      deleteTags,
      reload,
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
