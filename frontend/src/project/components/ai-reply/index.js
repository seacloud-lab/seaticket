import React, { useCallback, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import classnames from 'classnames';
import { ELementTypes } from '@seafile/seafile-editor';
import { CustomizeMarkdownViewer as CustomizeMarkdownViewerComponent, LinkVerifiedDialog } from '@/components';
import CustomizeDefinition from './customize-definition';
import CustomizeLinkReference from './customize-link-reference';
import CustomizeLink from './customize-link';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import {
  formatSources, transformMDFileToLink, transformKBToLink, transformReferencesToMarkdown,
  transformContentForCopy,
} from './utils';

import './index.css';

const AIReply = forwardRef(({
  messageId,
  message,
  projectUuid,
  projectName,
  workspaceID,
  className: propsClassName,
  canPreviewLinkedFile = true,
  openDocument,
}, ref) => {
  const [aiMessageType, setAIMessageType] = useState('rich-text');
  const [className, setClassName] = useState('');
  const [isShowResourceDetails, setIsShowResourceDetails] = useState(false);
  const [resource, setResource] = useState(null);
  const [isShowLinkVerifiedDialog, setIsShowLinkVerifiedDialog] = useState(false);

  const { aiReply, aiReplyForCopy, sources, mdFiles } = useMemo(() => {
    if (Object.keys(message).length === 0) return { aiReply: '', aiReplyForCopy: '', sources: [], mdFiles: [] };
    let value = message.ai_reply;
    let aiReplyForCopy = '';

    let sources = formatSources(message.sources, { workspaceID, projectName });
    let mdFiles = [];
    if (value) {
      value = transformMDFileToLink(value, mdFiles, messageId);
      value = transformKBToLink(value, { workspaceID, projectName });
    }

    if (value && messageId === 'typing') {
      const referenceXRegex = /<reference_(\d+)>/g;
      value = value.replace(referenceXRegex, '');
    }

    value = transformReferencesToMarkdown(value, sources);
    aiReplyForCopy = transformContentForCopy(value, { mdFiles, sources });
    if (sources.length > 0) {
      const sourcesString = sources.map((s, i) => `[${i + 1}]: ${s.url} "${s.title}"`).join('\n');
      value = value + `\n\n${sourcesString}`;
    }

    return {
      aiReply: value,
      aiReplyForCopy,
      sources,
      mdFiles,
    };
  }, [message, projectName, workspaceID, messageId]);

  const handleConnectionRecord = useCallback((record) => {
    setResource(record);
    setIsShowResourceDetails(true);
  }, []);

  const openConnectionRecord = useCallback((event, record) => {
    handleConnectionRecord(record);
  }, [handleConnectionRecord]);

  const closeConnectionRecord = useCallback(() => {
    setResource(null);
    setIsShowResourceDetails(false);
  }, []);

  const options = useMemo(() => {
    return {
      'loading': {
        render: (() => null)()
      },
      [ELementTypes.DEFINITION]: {
        render: (<CustomizeDefinition sources={sources} openDefinitionRecord={openConnectionRecord} />)
      },
      [ELementTypes.LINK_REFERENCE]: {
        render: (<CustomizeLinkReference />)
      },
      [ELementTypes.LINK]: {
        render: (<CustomizeLink canPreviewLinkedFile={canPreviewLinkedFile} openDocument={openDocument} mdFiles={mdFiles} />)
      }
    };
  }, [sources, mdFiles, canPreviewLinkedFile, openConnectionRecord, openDocument]);

  const beforeAIReplyRenderCallback = useCallback((value) => {
    const valueCount = value.length;
    if (valueCount === 1 && value[0].type === 'paragraph') {
      setAIMessageType('text');
    } else {
      setAIMessageType('rich-text');
    }
    const lastDom = value[valueCount - 1];
    if (lastDom.type === 'paragraph' && lastDom.children.length > 2) {
      const last2Child = lastDom.children[lastDom.children.length - 2];
      if (last2Child.type === 'link' && last2Child.url.startsWith('file:///sea-ticket/')) {
        setClassName('ends-with-link');
      }
    }
  }, []);

  const switchResource = useCallback((step) => {
    const index = sources.findIndex(r => r.key === resource.key);
    if (index === -1) return;

    let newIndex = index + step;
    if (newIndex > sources.length - 1) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      newIndex = sources.length - 1;
    }
    const currentRow = sources[newIndex];
    handleConnectionRecord(currentRow);
  }, [sources, resource, handleConnectionRecord]);

  useImperativeHandle(ref, () => ({
    getAIReply: () => aiReplyForCopy,
  }), [aiReplyForCopy]);

  return (
    <>
      {aiReply && (
        <div className={classnames('sea-ticket-ai-reply', aiMessageType, className, propsClassName)}>
          <CustomizeMarkdownViewerComponent
            value={aiReply}
            showTOC={false}
            isShowLoading={messageId?.startsWith('typing') && messageId === 'typing' ? false : true}
            options={options}
            beforeRenderCallback={beforeAIReplyRenderCallback}
            onDefinitionClick={openConnectionRecord}
          />
        </div>
      )}
      {isShowResourceDetails && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={resource}
          isShowIcon={true}
          switchResource={sources.length > 1 ? switchResource : null}
          onToggle={closeConnectionRecord}
        />
      )}
      {isShowLinkVerifiedDialog && (
        <LinkVerifiedDialog link={resource.url} onToggle={() => setIsShowLinkVerifiedDialog(false)} />
      )}
    </>
  );

});

export default AIReply;
