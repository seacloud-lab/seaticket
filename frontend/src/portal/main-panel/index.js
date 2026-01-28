import React, { useEffect, useMemo, useState } from 'react';
import { gettext } from '@/constants';
import { PORTAL_PAGE } from '../constants';
import { portalAPI } from '../api';
import SubmitTicket from './submit-ticket';
import MyTickets from './my-tickets';
import KnowledgeBase from './knowledge-base';

const MainPanel = ({ activePage, projectUuid, onPageChange }) => {
  const [isMetadataLoading, setIsMetadataLoading] = useState(true);
  const [tagsData, setTagsData] = useState({ rows: [], row_ids: [], id_row_map: {} });
  const [typesData, setTypesData] = useState({ rows: [], row_ids: [], id_row_map: {} });

  useEffect(() => {
    setIsMetadataLoading(true);
    portalAPI.getTicketMetadata(projectUuid).then((metadataRes) => {
      const tags = (metadataRes?.data?.tags?.options || []).map(t => ({ ...t, _id: t.id }));
      const types = (metadataRes?.data?.types?.options || []).map(t => ({ ...t, _id: t.id }));

      const tagsRowMap = {};
      tags.forEach(t => { tagsRowMap[t._id] = t; });

      const typesRowMap = {};
      types.forEach(t => { typesRowMap[t._id] = t; });

      setTagsData({
        rows: tags,
        row_ids: tags.map(t => t._id),
        id_row_map: tagsRowMap,
      });
      setTypesData({
        rows: types,
        row_ids: types.map(t => t._id),
        id_row_map: typesRowMap,
      });
      setIsMetadataLoading(false);
    }).catch(() => {
      setIsMetadataLoading(false);
    });
  }, [projectUuid]);

  const metadataPayload = useMemo(() => ({
    isMetadataLoading,
    tagsData,
    typesData,
  }), [isMetadataLoading, tagsData, typesData]);
  const getTitle = () => {
    switch (activePage) {
      case PORTAL_PAGE.SUBMIT_TICKET:
        return gettext('Submit ticket');
      case PORTAL_PAGE.MY_TICKETS:
        return gettext('My tickets');
      case PORTAL_PAGE.KNOWLEDGE_BASE:
        return gettext('Knowledge base');
      default:
        return '';
    }
  };

  const renderContent = () => {
    switch (activePage) {
      case PORTAL_PAGE.SUBMIT_TICKET:
        return (
          <SubmitTicket
            projectUuid={projectUuid}
            onPageChange={onPageChange}
            typesData={metadataPayload.typesData}
            isMetadataLoading={metadataPayload.isMetadataLoading}
          />
        );
      case PORTAL_PAGE.MY_TICKETS:
        return (
          <MyTickets
            projectUuid={projectUuid}
            tagsData={metadataPayload.tagsData}
            typesData={metadataPayload.typesData}
            isMetadataLoading={metadataPayload.isMetadataLoading}
          />
        );
      case PORTAL_PAGE.KNOWLEDGE_BASE:
        return <KnowledgeBase projectUuid={projectUuid} />;
      default:
        return null;
    }
  };

  return (
    <div className="sea-qa-portal-main-panel">
      <div className="sea-qa-portal-top-bar">
        {getTitle()}
      </div>
      <div className="sea-qa-portal-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default MainPanel;
