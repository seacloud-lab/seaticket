import React, { useContext, useEffect, useState, useCallback } from 'react';
import deepCopy from 'deep-copy';
import { Utils } from '@/utils/utils';
import { toaster } from '@/components';
import { OptionsData, Option } from '../models';
import { PREDEFINED_TICKET_SUBSTATE_OPTION } from '../constants';
import { portalAPI } from '@/portal/api';

const PortalIssuesMetadataContext = React.createContext(null);

export const PortalIssuesMetadataProvider = ({
  projectUuid,
  api = portalAPI,
  children,
}) => {
  const [isLoading, setLoading] = useState(true);

  const [substatesData, setSubstatesData] = useState(new OptionsData());
  const [typesData, setTypesData] = useState(new OptionsData());
  const [statesData, setStatesData] = useState(new OptionsData());

  // type
  const applyCreateTypes = useCallback((newTypes, isReload = false) => {
    let newData = isReload ? new OptionsData({}) : deepCopy(typesData);
    if (Array.isArray(newTypes) && newTypes.length > 0) {
      newTypes.forEach(type => {
        const newType = type instanceof Option ? type : new Option(type);
        newData.rows.push(newType);
        newData.row_ids.push(newType._id);
        newData.id_row_map[newType._id] = newType;
      });
    }
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
    return api.createPortalIssueType(projectUuid, type).then(res => {
      const type = new Option(res.data.type);
      applyCreateTypes([type]);
      return type;
    });
  }, [projectUuid, applyCreateTypes, api]);

  const deleteType = useCallback((typeID) => {
    return api.deletePortalIssueType(projectUuid, typeID).then(res => {
      applyDeleteTypes([typeID]);
      return typeID;
    });
  }, [projectUuid, applyDeleteTypes, api]);

  const deleteTypes = useCallback((typeIDs) => {
    return api.deletePortalIssueTypes(projectUuid, typeIDs).then(res => {
      applyDeleteTypes(typeIDs);
      return {
        data: {
          success: typeIDs,
          failed: [],
        }
      };
    });
  }, [projectUuid, applyDeleteTypes, api]);

  const modifyType = useCallback((typeID, update) => {
    return api.modifyPortalIssueType(projectUuid, typeID, update).then(res => {
      applyModifyTypes({ [typeID]: update });
    });
  }, [projectUuid, applyModifyTypes, api]);

  const loadTypes = useCallback((callback) => {
    const username = (window.app && window.app.pageOptions && window.app.pageOptions.username) || '';
    if (!username) {
      callback && callback();
      return;
    }
    api.listPortalIssueTypes(projectUuid).then(res => {
      const types = Array.isArray(res.data.types) ? res.data.types : [];
      applyCreateTypes(types, true);
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback();
    });
  }, [typesData, api]);

  // substate
  const applyCreateSubstates = useCallback((newSubstates, isReload = false) => {
    let newData = isReload ? new OptionsData({}) : deepCopy(substatesData);
    if (Array.isArray(newSubstates) && newSubstates.length > 0) {
      newSubstates.forEach(substate => {
        const newSubstate = substate instanceof Option ? substate : new Option(substate, PREDEFINED_TICKET_SUBSTATE_OPTION);
        newData.rows.push(newSubstate);
        newData.row_ids.push(newSubstate._id);
        newData.id_row_map[newSubstate._id] = newSubstate;
      });
    }
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
    return api.createPortalIssueSubstate(projectUuid, substate).then(res => {
      const newSubstate = new Option({ ...res.data.substate, parent_id: substate.parent_id });
      applyCreateSubstates([newSubstate]);
      return newSubstate;
    });
  }, [projectUuid, applyCreateSubstates, api]);

  const deleteSubstate = useCallback((substateID) => {
    return api.deletePortalIssueSubstate(projectUuid, substateID).then(res => {
      applyDeleteSubstates([substateID]);
      return substateID;
    });
  }, [projectUuid, applyDeleteSubstates, api]);

  const deleteSubstates = useCallback((substateIDs) => {
    return api.deletePortalIssueSubstates(projectUuid, substateIDs).then(res => {
      applyDeleteSubstates(substateIDs);
      return {
        data: {
          success: substateIDs,
          failed: [],
        }
      };
    });
  }, [projectUuid, applyDeleteSubstates, api]);

  const modifySubstate = useCallback((substateID, update) => {
    return api.modifyPortalIssueSubstate(projectUuid, substateID, update).then(res => {
      applyModifySubstates({ [substateID]: update });
    });
  }, [projectUuid, applyModifySubstates, api]);

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

  const loadSubStates = useCallback((callback) => {
    const username = (window.app && window.app.pageOptions && window.app.pageOptions.username) || '';
    if (!username) {
      callback && callback();
      return;
    }
    api.listPortalIssueSubstates(projectUuid).then(res => {
      const { substates, cascade_settings } = res.data;
      initSubStates(substates, cascade_settings, true);
      callback && callback();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      callback && callback();
    });
  }, [substatesData, initSubStates, api]);

  // state
  const applyCreateStates = useCallback((newStates, isReload = false) => {
    let newData = isReload ? new OptionsData({}) : deepCopy(statesData);
    if (Array.isArray(newStates) && newStates.length > 0) {
      newStates.forEach(state => {
        const option = state instanceof Option ? state : new Option(state);
        newData.rows.push(option);
        newData.row_ids.push(option._id);
        newData.id_row_map[option._id] = option;
      });
    }
    setStatesData(newData);
  }, [statesData]);

  useEffect(() => {
    api.getPortalIssueMetadata(projectUuid).then(res => {
      const { states, substates, types } = res?.data || {};
      initSubStates(substates?.options, substates?.cascade_settings);
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
    <PortalIssuesMetadataContext.Provider value={{
      isLoading,

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
    </PortalIssuesMetadataContext.Provider>
  );
};

export const usePortalIssuesMetadata = () => {
  const context = useContext(PortalIssuesMetadataContext);
  if (!context) {
    throw new Error('\'PortalIssuesMetadataContext\' is null');
  }
  return context;
};
