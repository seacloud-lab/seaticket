import React, { useMemo } from 'react';
import { CustomizePopover } from '@/components';
import { useTagsData } from '@/sea-metadata/hooks';
import { getTagsOptions } from '@/sea-metadata/utils/column';
import Tag from '@/sea-metadata/components/tag';
import { getRowById } from '@/sea-metadata/utils/row';
import { gettext } from '@/constants';
import Container from '@/components/options-editor/sync-options-editor/container';
import RemoveBtn from '@/sea-metadata/components/tag/remove-btn';

const TagSelector = ({
  isMultiple = true,
  value,
  target,
  modifiers = [
    { name: 'preventOverflow', options: { boundary: document.body } },
    { name: 'offset', options: { offset: [0, 4] } }
  ],
  onChange,
  onToggle,
}) => {
  const { tagsData } = useTagsData();

  const options = useMemo(() => {
    const tags = getTagsOptions(tagsData);
    if (!Array.isArray(tags) || tags.length === 0) return [];
    return tags.map(tag => ({
      value: tag.id,
      name: tag.name,
      label: (<Tag tag={tag} />)
    }));
  }, [tagsData]);

  return (
    <CustomizePopover
      target={target}
      className="options-editor-popover sea-metadata-data-filter-popover"
      modifiers={modifiers}
      sameWidthWithTarget={300}
      hidePopover={onToggle}
      hidePopoverWithEsc={onToggle}
    >
      <Container
        isMultiple={isMultiple}
        placeholder={gettext('Search tags')}
        emptyTip={gettext('No tags available')}
        value={Array.isArray(value) ? value.map(v => String(v)) : []}
        options={options}
        onChange={onChange}
      >
        {({ value: selectedTagIds, onChange }) => {
          if (!Array.isArray(selectedTagIds) || selectedTagIds.length === 0) return null;
          return selectedTagIds.map(tagId => {
            const tag = getRowById(tagsData, tagId);
            if (!tag) return null;
            return (
              <Tag tag={tag} key={tagId} className="mr-0">
                <RemoveBtn callback={() => onChange(tagId)} />
              </Tag>
            );
          });
        }}
      </Container>
    </CustomizePopover>
  );
};

export default TagSelector;
