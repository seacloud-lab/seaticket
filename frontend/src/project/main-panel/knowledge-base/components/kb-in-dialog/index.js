import React, { useEffect, useState, useRef } from 'react';
import { CenteredLoading, CenteredError } from '@/components';
import { knowledgeBaseAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import dayjs from '@/utils/dayjs';
import classnames from 'classnames';
import { lang } from '@/constants';
import Comment from '@/project/main-panel/tickets/components/comment';
import TagsSettings from '@/project/main-panel/tags/tags-settings';
import { useTags } from '@/project/hooks';

const KBInDialog = ({ projectUuid, knowledgeID, updateKB }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [knowledge, setKnowledge] = useState('');
  const [containerWidth, setContainerWidth] = useState(0);
  const kbRef = useRef(null);

  const { tagsData } = useTags();

  useEffect(() => {
    setIsLoading(true);
    knowledgeBaseAPI.getRecord(projectUuid, knowledgeID).then(res => {
      const knowledge = res?.data.record || {};
      if (knowledge.created_time) {
        knowledge.created_time = dayjs(knowledge.created_time).fromNow();
      }
      setKnowledge(knowledge);
      updateKB(knowledge);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [knowledgeID]);

  useEffect(() => {
    if (isLoading || !knowledge) return;
    const kbDomRef = kbRef.current;
    const handleResize = () => {
      if (!kbDomRef) return;
      setContainerWidth(kbDomRef.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    kbDomRef && resizeObserver.observe(kbDomRef);

    return () => {
      kbDomRef && resizeObserver.unobserve(kbDomRef);
    };
  }, [isLoading, knowledge]);

  if (isLoading) return (<CenteredLoading />);
  if (errorMessage) return (<CenteredError>{errorMessage}</CenteredError>);

  const isSmallScreen = containerWidth < 780;

  return (
    <div className={classnames('sea-qa-project-ticket sea-qa-project-ticket-in-dialog', { 'small': isSmallScreen })} ref={kbRef}>
      <div className="sea-qa-project-ticket-content-wrapper">
        <div className="sea-qa-project-ticket-comment-container-wrapper">
          <Comment
            isSmallScreen={isSmallScreen}
            comment={knowledge}
            isShowStatus={true}
            readonly={true}
            lang={lang}
          />
        </div>
        <div className="sea-qa-project-ticket-other-settings">
          <TagsSettings
            id="tags-editor-popover"
            isReadonly={true}
            value={knowledge?.tags || []}
            tagsData={tagsData}
          />
        </div>
      </div>
    </div>
  );
};

export default KBInDialog;
