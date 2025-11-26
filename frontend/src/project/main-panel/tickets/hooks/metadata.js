import React, { useContext, useEffect, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import deepCopy from 'deep-copy';
import { Utils } from '@/utils/utils';
import { toaster } from '@/components';
import { ticketsAPI } from '../../../api';
import { OptionsData, Option } from '../models';
import { PREDEFINED_TICKET_TAG } from '../constants';

const MetadataContext = React.createContext(null);

export const MetadataProvider = ({ projectUuid, children }) => {
  const [isLoading, setLoading] = useState(true);

  const [tagsData, setTagsData] = useState(new OptionsData());
  const [substatesData, setSubstatesData] = useState(new OptionsData());
  const [typesData, setTypesData] = useState(new OptionsData());
  const [statesData, setStatesData] = useState(new OptionsData());

  // tags
  const applyCreateTags = useCallback((newTags, isReload = false) => {
    if (!Array.isArray(newTags) || newTags.length === 0) return;
    let newData = isReload ? new OptionsData({}, new Date()) : deepCopy(tagsData);
    newTags.forEach(tag => {
      const newTag = tag instanceof Option ? tag : new Option(tag);
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
      const tag = new Option(res.data.tag, PREDEFINED_TICKET_TAG);
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

  const loadTags = useCallback(() => {
    const currentTime = new Date();
    if (tagsData.loadTime && dayjs(currentTime).diff(tagsData.loadTime, 'hours') < 1) return;
    const newTagsData = tagsData._updateLoading(true);
    setTagsData(newTagsData);
    ticketsAPI.listTicketTags(projectUuid).then(res => {
      const tags = Array.isArray(res.data.tags) ? res.data.tags : [];
      applyCreateTags(tags, true);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      const newTagsData = tagsData._updateLoading(false);
      setTagsData(newTagsData);
    });
  }, [tagsData]);

  // type
  const applyCreateTypes = useCallback((newTypes, isReload = false) => {
    if (!Array.isArray(newTypes) || newTypes.length === 0) return;
    let newData = isReload ? new OptionsData({}, new Date()) : deepCopy(typesData);
    newTypes.forEach(type => {
      const newType = type instanceof Option ? type : new Option(type);
      newData.rows.push(newType);
      newData.row_ids.push(newType._id);
      newData.id_row_map[newType._id] = newType;
    });
    setTypesData(newData);
  }, [typesData]);

  const applyDeleteTypes = useCallback((typeIDs) => {
    if (!Array.isArray(typeIDs) || typeIDs.length === 0) return;
    setTypesData(prevData => {
      const newData = {
        ...prevData,
        rows: prevData.rows.filter(r => !typeIDs.includes(r._id)),
        row_ids: prevData.row_ids.filter(r => !typeIDs.includes(r)),
        id_row_map: { ...prevData.id_row_map }
      };
      typeIDs.forEach(typeID => {
        if (newData.id_row_map[typeID]) {
          delete newData.id_row_map[typeID];
        }
      });
      return newData;
    });
  }, [typesData]);

  const applyModifyTypes = useCallback((update = {}) => {
    if (Object.keys(update).length === 0) return;
    let newData = deepCopy(typesData);
    Object.keys(update).forEach(typeID => {
      const rowIndex = newData.row_ids.findIndex(rID => rID === typeID);
      if (rowIndex > -1) {
        let newRow = newData.id_row_map[typeID];
        newRow = newRow._update(update[typeID]);
        newData.rows[rowIndex] = newRow;
        newData.id_row_map[typeID] = newRow;
      }
    });
    setTypesData(newData);
  }, [typesData]);

  const createType = useCallback((type) => {
    return ticketsAPI.createTicketType(projectUuid, type).then(res => {
      const type = new Option(res.data.type);
      applyCreateTypes([type]);
      return type;
    });
  }, [projectUuid, applyCreateTypes]);

  const deleteType = useCallback((typeID) => {
    return ticketsAPI.deleteTicketType(projectUuid, typeID).then(res => {
      applyDeleteTypes([typeID]);
      return typeID;
    });
  }, [projectUuid, applyDeleteTypes]);

  const deleteTypes = useCallback((typeIDs) => {
    return ticketsAPI.deleteTicketTypes(projectUuid, typeIDs).then(res => {
      applyDeleteTypes(typeIDs);
      return {
        data: {
          success: typeIDs,
          failed: [],
        }
      };
    });
  }, [projectUuid, applyDeleteTypes]);

  const modifyType = useCallback((typeID, update) => {
    return ticketsAPI.modifyTicketType(projectUuid, typeID, update).then(res => {
      applyModifyTypes({ [typeID]: update });
    });
  }, [projectUuid, applyModifyTypes]);

  const loadTypes = useCallback(() => {
    const currentTime = new Date();
    if (typesData.loadTime && dayjs(currentTime).diff(typesData.loadTime, 'hours') < 1) return;
    const newTypesData = typesData._updateLoading(true);
    setTypesData(newTypesData);
    ticketsAPI.listTicketTypes(projectUuid).then(res => {
      const types = Array.isArray(res.data.types) ? res.data.types : [];
      applyCreateTypes(types, true);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      const newTypesData = typesData._updateLoading(false);
      setTypesData(newTypesData);
    });
  }, [typesData]);

  // substate
  const applyCreateSubstates = useCallback((newSubstates, isReload = false) => {
    if (!Array.isArray(newSubstates) || newSubstates.length === 0) return;
    let newData = isReload ? new OptionsData({}, new Date()) : deepCopy(substatesData);
    newSubstates.forEach(substate => {
      const newSubstate = substate instanceof Option ? substate : new Option(substate);
      newData.rows.push(newSubstate);
      newData.row_ids.push(newSubstate._id);
      newData.id_row_map[newSubstate._id] = newSubstate;
    });
    setSubstatesData(newData);
  }, [substatesData]);

  const applyDeleteSubstates = useCallback((substateIDs) => {
    if (!Array.isArray(substateIDs) || substateIDs.length === 0) return;
    let newData = deepCopy(substatesData);
    newData.rows = newData.rows.filter(r => !substateIDs.includes(r._id));
    newData.row_ids = newData.row_ids.filter(r => !substateIDs.includes(r));
    substateIDs.forEach(substateID => {
      if (newData.id_row_map[substateID]) {
        delete newData.id_row_map[substateID];
      }
    });
    setSubstatesData(newData);
  }, [substatesData]);

  const applyModifySubstates = useCallback((update = {}) => {
    if (Object.keys(update).length === 0) return;
    let newData = deepCopy(substatesData);
    Object.keys(update).forEach(substateID => {
      const rowIndex = newData.row_ids.findIndex(rID => rID === substateID);
      if (rowIndex > -1) {
        let newRow = newData.id_row_map[substateID];
        newRow = newRow._update(update[substateID]);
        newData.rows[rowIndex] = newRow;
        newData.id_row_map[substateID] = newRow;
      }
    });
    setSubstatesData(newData);
  }, [substatesData]);

  const createSubstate = useCallback((substate) => {
    return ticketsAPI.createTicketSubstate(projectUuid, substate).then(res => {
      const newSubstate = new Option({ ...res.data.substate, parent_id: substate.parent_id });
      applyCreateSubstates([newSubstate]);
      return newSubstate;
    });
  }, [projectUuid, applyCreateSubstates]);

  const deleteSubstate = useCallback((substateID) => {
    return ticketsAPI.deleteTicketSubstate(projectUuid, substateID).then(res => {
      applyDeleteSubstates([substateID]);
      return substateID;
    });
  }, [projectUuid, applyDeleteSubstates]);

  const deleteSubstates = useCallback((substateIDs) => {
    return ticketsAPI.deleteTicketSubstates(projectUuid, substateIDs).then(res => {
      applyDeleteSubstates(substateIDs);
      return {
        data: {
          success: substateIDs,
          failed: [],
        }
      };
    });
  }, [projectUuid, applyDeleteSubstates]);

  const modifySubstate = useCallback((substateID, update) => {
    return ticketsAPI.modifyTicketSubstate(projectUuid, substateID, update).then(res => {
      applyModifySubstates({ [substateID]: update });
    });
  }, [projectUuid, applyModifySubstates]);

  const initSubStates = useCallback((options, cascade_settings = {}, isReload = false) => {
    let substatesOptions = options || [];
    let cascadeConfig = {};
    Object.keys(cascade_settings).forEach(parentOptionId => {
      const childrenOptionIds = cascade_settings[parentOptionId] || [];
      childrenOptionIds.forEach(childrenOptionId => {
        cascadeConfig[childrenOptionId] = parentOptionId;
      });
    });
    substatesOptions = substatesOptions.map(option => {
      return { ...option, parent_id: cascadeConfig[option.id] };
    });
    applyCreateSubstates(substatesOptions, isReload);
  }, [applyCreateSubstates]);

  const loadSubStates = useCallback(() => {
    const currentTime = new Date();
    if (substatesData.loadTime && dayjs(currentTime).diff(substatesData.loadTime, 'hours') < 1) return;
    const newSubstatesData = substatesData._updateLoading(true);
    setSubstatesData(newSubstatesData);
    ticketsAPI.listTicketSubstates(projectUuid).then(res => {
      const { substates, cascade_settings } = res.data;
      initSubStates(substates, cascade_settings, true);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      const newSubstatesData = substatesData._updateLoading(false);
      setSubstatesData(newSubstatesData);
    });
  }, [substatesData, initSubStates]);

  // state
  const applyCreateStates = useCallback((newStates, isReload = false) => {
    if (!Array.isArray(newStates) || newStates.length === 0) return;
    let newData = isReload ? new OptionsData({}, new Date()) : deepCopy(statesData);
    newStates.forEach(tag => {
      const option = tag instanceof Option ? tag : new Option(tag);
      newData.rows.push(option);
      newData.row_ids.push(option._id);
      newData.id_row_map[option._id] = option;
    });
    setStatesData(newData);
  }, [statesData]);

  useEffect(() => {
    ticketsAPI.getTicketMetadata(projectUuid).then(res => {
      const { states, substates, tags, types } = res?.data || {};
      initSubStates(substates?.options, substates?.cascade_settings);
      applyCreateTags(tags?.options);
      applyCreateTypes(types?.options);
      applyCreateStates(states?.options);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  }, []);

  return (
    <MetadataContext.Provider value={{
      isLoading,
      tagsData,
      createTag,
      modifyTag,
      deleteTag,
      deleteTags,
      loadTags,

      typesData,
      createType,
      modifyType,
      deleteType,
      deleteTypes,
      loadTypes,

      statesData,
      substatesData,
      createSubstate,
      modifySubstate,
      deleteSubstate,
      deleteSubstates,
      loadSubStates,
    }}>
      {children}
    </MetadataContext.Provider>
  );
};

export const useMetadata = () => {
  const context = useContext(MetadataContext);
  if (!context) {
    throw new Error('\'MetadataContext\' is null');
  }
  return context;
};
