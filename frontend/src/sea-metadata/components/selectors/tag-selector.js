import React, { useMemo } from 'react';
import classnames from 'classnames';
import { OptionsEditor, RemoveButton } from '@/components';
import { useTagsData } from '@/sea-metadata/hooks';
import { getTagsOptions } from '@/sea-metadata/utils/column';
import Tag from '@/sea-metadata/components/tag';
import { getRowById } from '@/sea-metadata/utils/row';
import { gettext } from '@/constants';

const TagSelector = ({
  isMultiple = true,
  className,
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
    <OptionsEditor
      className={classnames('sea-metadata-data-filter-popover', className)}
      target={target}
      modifiers={modifiers}
      sameWidthWithTarget={300}
      onToggle={onToggle}
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
              <RemoveButton callback={() => onChange(tagId)} />
            </Tag>
          );
        });
      }}
    </OptionsEditor>
  );
};

export default TagSelector;
