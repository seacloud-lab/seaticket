import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import deepCopy from 'deep-copy';
import { Utils } from '@/utils/utils';
import { toaster } from '@/components';
import { TypesData, Type } from '../models';
import { ticketsAPI } from '../../../api';

const TypesContext = React.createContext(null);

export const TypesProvider = ({ projectUuid, children }) => {
  const [isLoading, setLoading] = useState(true);
  const [typesData, setTypesData] = useState(new TypesData());
  const [isReLoading, setReLoading] = useState(false);

  const loadTime = useRef(new Date());

  const applyCreateTypes = useCallback((newTypes, isReload = false) => {
    if (!Array.isArray(newTypes) || newTypes.length === 0) return;
    let newData = isReload ? new TypesData() : deepCopy(typesData);
    newTypes.forEach(type => {
      const newType = type instanceof Type ? type : new Type(type);
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
      const type = new Type(res.data.project_type);
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
      return typeIDs;
    });
  }, [projectUuid, applyDeleteTypes]);

  const modifyType = useCallback((typeID, update) => {
    return ticketsAPI.modifyTicketType(projectUuid, typeID, update).then(res => {
      applyModifyTypes({ [typeID]: update });
    });
  }, [projectUuid, applyModifyTypes]);

  const reload = useCallback(() => {
    const currentTime = new Date();
    if (dayjs(currentTime).diff(loadTime.current, 'hours') < 1) return;
    loadTime.current = currentTime;
    setReLoading(true);
    ticketsAPI.listTicketTypes(projectUuid).then(res => {
      const types = Array.isArray(res.data.project_types) ? res.data.project_types : [];
      applyCreateTypes(types, true);
      setReLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setReLoading(false);
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    ticketsAPI.listTicketTypes(projectUuid).then(res => {
      const types = Array.isArray(res.data.project_types) ? res.data.project_types : [];
      applyCreateTypes(types);
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
    <TypesContext.Provider value={{
      isLoading,
      isReLoading,
      typesData,
      createType,
      modifyType,
      deleteType,
      deleteTypes,
      reload,
    }}>
      {children}
    </TypesContext.Provider>
  );
};

export const useTypes = () => {
  const context = useContext(TypesContext);
  if (!context) {
    throw new Error('\'TypesContext\' is null');
  }
  return context;
};
