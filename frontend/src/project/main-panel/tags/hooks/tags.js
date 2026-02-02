import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import deepCopy from 'deep-copy';
import { Utils } from '@/utils/utils';
import { toaster } from '@/components';
import { TagsData, Tag } from '../models';
import projectAPI from '@/project/api/project-api';
import { shouldReload } from '@/project/utils';

const TagsContext = React.createContext(null);

export const TagsProvider = ({ projectUuid, api = projectAPI, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [tagsData, setTagsData] = useState(new TagsData({}));

  const lastLoadTime = useRef(0);

  const applyCreateTags = useCallback((newTags) => {
    let newData = deepCopy(tagsData);
    if (Array.isArray(newTags) && newTags.length > 0) {
      newTags.forEach(tag => {
        const newTag = tag instanceof Tag ? tag : new Tag(newData.columns, tag);
        newData.rows.push(newTag);
        newData.row_ids.push(newTag._id);
        newData.id_row_map[newTag._id] = newTag;
      });
    }
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
    return projectAPI.createTag(projectUuid, tag).then(res => {
      const tag = new Tag([], res.data.tag);
      applyCreateTags([tag]);
      return tag;
    });
  }, [projectUuid, applyCreateTags]);

  const deleteTag = useCallback((tagID) => {
    return projectAPI.deleteTag(projectUuid, tagID).then(res => {
      applyDeleteTags([tagID]);
      return tagID;
    });
  }, [projectUuid, applyDeleteTags]);

  const deleteTags = useCallback((tagIDs) => {
    return projectAPI.deleteTags(projectUuid, tagIDs).then(res => {
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
    return projectAPI.modifyTag(projectUuid, tagID, update).then(res => {
      applyModifyTags({ [tagID]: update });
    });
  }, [projectUuid, applyModifyTags]);

  const loadTags = useCallback((callback) => {
    if (lastLoadTime.current && shouldReload(lastLoadTime.current)) {
      api.listTags(projectUuid).then(res => {
        const columns = Array.isArray(res.data.columns) ? res.data.columns : [];
        const tags = Array.isArray(res.data.tags) ? res.data.tags : [];
        const newData = new TagsData({ tags, columns });
        setTagsData(newData);
        callback && callback();
      }).catch(error => {
        const errorMessage = Utils.getErrorMsg(error);
        toaster.danger(errorMessage);
        callback && callback();
      });
      return;
    }
    callback && callback();
  }, [tagsData]);

  useEffect(() => {
    api.listTags(projectUuid).then(res => {
      const columns = Array.isArray(res.data.columns) ? res.data.columns : [];
      const tags = Array.isArray(res.data.tags) ? res.data.tags : [];
      const newData = new TagsData({ tags, columns });
      setTagsData(newData);
      setLoading(false);
      lastLoadTime.current = Date.now();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, []);

  return (
    <TagsContext.Provider value={{
      isLoading,
      tagsData,
      createTag,
      modifyTag,
      deleteTag,
      deleteTags,
      loadTags,
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
