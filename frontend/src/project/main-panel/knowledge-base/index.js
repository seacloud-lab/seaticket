import React, { useMemo, useState, useCallback } from 'react';
import { Button } from 'reactstrap';
import { gettext, server } from '@/constants';
import { Icon, toaster } from '@/components';
import SeaMetadata, { CollaboratorsProvider } from '@/sea-metadata';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import eventBus from '@/utils/event-bus';
import TopBar from '../top-bar';
import { knowledgeBaseAPI } from '../../api';
import LongTextEditorUtilities from '@/utils/long-text';
import AddKnowledgeDialog from './add-knowledge-dialog';

import './knowledge-base.css';

const { projectUuid, permission } = window.app.pageOptions;

const KnowledgeBase = ({ title }) => {
  const [viewID, setViewID] = useState('0000');
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isEditMode, setEditMode] = useState(false);
  const [editRowId, setEditRowId] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const editorAPI = useMemo(() => new LongTextEditorUtilities({ server, api: {
    uploadFile: (file) => knowledgeBaseAPI.uploadFile(projectUuid, file)
  } }), []);

  const toggleView = useCallback((newViewID) => {
    setViewID(newViewID);
  }, []);

  const api = useMemo(() => {
    const getMetadata = (...params) => {
      return knowledgeBaseAPI.getKnowledgeBase(projectUuid, ...params).then(res => {
        const records = res?.data?.records || [];
        const rows = Array.isArray(records) ? records.map(r => ({ ...r, _id: r._pk })) : [];
        const DISPLAY_NAME_MAP = {
          question: gettext('Question'),
          answer: gettext('Answer'),
          creator: gettext('Creator'),
          created_time: gettext('Created time'),
          last_modifier: gettext('Last modifier'),
          modified_time: gettext('Last modified time'),
        };
        let columns = (res?.data?.columns || [])
          .filter(c => c.name !== '_pk')
          .map(c => {
            let col = c;
            if (c.name === 'creator') col = { ...col, type: 'creator' };
            if (c.name === 'last_modifier') col = { ...col, type: 'last-modifier' };
            if (c.name === 'created_time') col = { ...col, type: 'ctime' };
            if (c.name === 'modified_time') col = { ...col, type: 'mtime' };
            if (c.name === 'answer') col = { ...col, type: 'long-text' };
            return { ...col, display_name: DISPLAY_NAME_MAP[c.name] || col.display_name || col.name };
          });
        return { data: { rows, columns } };
      });
    };
    return {
      getMetadata,
      getViews: () => knowledgeBaseAPI.listViews(projectUuid),
      getView: (id) => knowledgeBaseAPI.getView(projectUuid, id),
      insertView: (name, viewData) => knowledgeBaseAPI.insertView(projectUuid, name, viewData),
      deleteView: (id) => knowledgeBaseAPI.deleteView(projectUuid, id),
      moveView: (sourceId, targetId) => knowledgeBaseAPI.moveView(projectUuid, sourceId, targetId),
      duplicateView: (id) => knowledgeBaseAPI.duplicateView(projectUuid, id),
      modifyView: (id, viewData) => knowledgeBaseAPI.modifyView(projectUuid, id, viewData),
      deleteRow: (recordNumber) => knowledgeBaseAPI.deleteRecord(projectUuid, recordNumber),
      uploadFile: (file) => knowledgeBaseAPI.uploadFile(projectUuid, file),
    };
  }, []);

  const localStorageName = useMemo(() => `sea-qa-${projectUuid}-knowledge-base`, []);

  const t = useMemo(() => ({
    row: gettext('record'),
    rows: gettext('records'),
    Row: gettext('Record'),
    Rows: gettext('Records'),
  }), []);

  const listUserInfo = useCallback((...params) => knowledgeBaseAPI.listUserInfo(...params), []);
  const getCollaborators = useCallback(() => knowledgeBaseAPI.listProjectRelatedUsers(projectUuid), [projectUuid]);

  const openDialog = useCallback(() => {
    setEditMode(false);
    setEditRowId('');
    setQuestion('');
    setAnswer('');
    setDialogOpen(true);
  }, []);
  const openEditDialog = useCallback((row) => {
    setEditMode(true);
    setEditRowId(row._id);
    setQuestion(row.question || '');
    setAnswer(row.answer || '');
    setDialogOpen(true);
  }, []);
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditMode(false);
    setEditRowId('');
    setQuestion('');
    setAnswer('');
  }, []);

  const onSubmit = useCallback(() => {
    const q = question.trim();
    const a = answer;
    if (!q || !a || !((typeof a === 'object' ? a.text : a).trim())) return;
    setSubmitting(true);
    const action = isEditMode
      ? knowledgeBaseAPI.updateRecord(projectUuid, editRowId, { question: q, answer: a })
      : knowledgeBaseAPI.createRecord(projectUuid, { question: q, answer: a });
    action.then(() => {
      toaster.success(isEditMode ? gettext('Record updated') : gettext('Record created'));
      setDialogOpen(false);
      setQuestion('');
      setAnswer('');
      eventBus.dispatch(EVENT_BUS_TYPE.RELOAD_DATA);
    }).catch(error => {
      const errorMessage = (error?.response?.data?.error_msg) || gettext(isEditMode ? 'Failed to update record' : 'Failed to create record');
      toaster.danger(errorMessage);
    }).finally(() => setSubmitting(false));
  }, [question, answer, isEditMode, editRowId]);

  return (
    <>
      <TopBar>
        {title}
        <Button color="primary" onClick={openDialog} className="sea-qa-project-add-kb-record-btn">
          <Icon symbol="add" className="mr-2" />
          {gettext('Add record')}
        </Button>
      </TopBar>
      <CollaboratorsProvider
        listUserInfo={listUserInfo}
        getCollaborators={getCollaborators}
      >
        <SeaMetadata
          viewID={viewID}
          api={api}
          permission={permission}
          isViewComputedOnServer={true}
          localStorageNamePrefix={localStorageName}
          toggleView={toggleView}
          t={t}
          createContextMenuOptions={({ isGroupView, selectedRange, selectedPosition, table, rowMetrics, deleteRows, rowGetterByIndex }) => {
            let list = [];
            if (selectedRange) return list;
            const selectedRowIds = rowMetrics ? Object.keys(rowMetrics.idSelectedRowMap) : [];
            if (selectedRowIds.length > 1) {
              if (deleteRows) list.push({ label: gettext('Delete records'), callback: () => deleteRows(selectedRowIds) });
              return list;
            }
            if (!selectedPosition) return list;
            const { groupRowIndex, rowIdx: rowIndex } = selectedPosition;
            const row = rowGetterByIndex({ isGroupView, groupRowIndex, rowIndex }) || table.id_row_map[selectedRowIds[0]];
            if (!row) return list;
            list.push({ label: gettext('Edit record'), callback: () => openEditDialog(row) });
            if (deleteRows) list.push({ label: gettext('Delete record'), callback: () => deleteRows([row._id]) });
            return list;
          }}
        />
      </CollaboratorsProvider>
      <AddKnowledgeDialog
        isOpen={isDialogOpen}
        toggle={closeDialog}
        isSubmitting={isSubmitting}
        question={question}
        answer={answer}
        setQuestion={setQuestion}
        setAnswer={setAnswer}
        onSubmit={onSubmit}
        editorAPI={editorAPI}
      />
    </>
  );
};

export default KnowledgeBase;
