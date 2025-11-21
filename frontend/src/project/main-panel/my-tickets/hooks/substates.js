import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import deepCopy from 'deep-copy';
import { Utils } from '@/utils/utils';
import { toaster } from '@/components';
import { SubstatesData, Substate } from '../models';
import { ticketsAPI } from '../../../api';

const SubstatesContext = React.createContext(null);

export const SubstatesProvider = ({ projectUuid, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [substatesData, setSubstatesData] = useState(new SubstatesData());
  const [isReLoading, setReLoading] = useState(false);

  const loadTime = useRef(new Date());

  const applyCreateSubstates = useCallback((newSubstates, isReload = false) => {
    if (!Array.isArray(newSubstates) || newSubstates.length === 0) return;
    let newData = isReload ? new SubstatesData() : deepCopy(substatesData);
    newSubstates.forEach(substate => {
      const newSubstate = substate instanceof Substate ? substate : new Substate(substate);
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
      const substate = new Substate(res.data.project_substate);
      applyCreateSubstates([substate]);
      return substate;
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

  const reload = useCallback(() => {
    const currentTime = new Date();
    if (dayjs(currentTime).diff(loadTime.current, 'hours') < 1) return;
    loadTime.current = currentTime;
    setReLoading(true);
    ticketsAPI.listTicketSubstates(projectUuid).then(res => {
      const substates = Array.isArray(res.data.project_substates) ? res.data.project_substates : [];
      applyCreateSubstates(substates, true);
      setReLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setReLoading(false);
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    ticketsAPI.listTicketSubstates(projectUuid).then(res => {
      const substates = Array.isArray(res.data.project_substates) ? res.data.project_substates : [];
      applyCreateSubstates(substates);
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
    <SubstatesContext.Provider value={{
      isLoading,
      isReLoading,
      substatesData,
      createSubstate,
      modifySubstate,
      deleteSubstate,
      deleteSubstates,
      reload,
    }}>
      {children}
    </SubstatesContext.Provider>
  );
};

export const useSubstates = () => {
  const context = useContext(SubstatesContext);
  if (!context) {
    throw new Error('\'SubstatesContext\' is null');
  }
  return context;
};
