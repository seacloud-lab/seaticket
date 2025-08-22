import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { getRowById } from '../../../utils/row';
import { useTagsData } from '../../../hooks';
import Tag from '../../tag';

import './index.css';

const TagsFormatter = ({ value: oldValue, className, children: emptyFormatter, showName = false }) => {

  const { tagsData } = useTagsData();

  const value = useMemo(() => {
    if (!Array.isArray(oldValue) || oldValue.length === 0) return [];
    return oldValue.filter(item => getRowById(tagsData, item));
  }, [oldValue, tagsData]);

  if (value.length === 0) return emptyFormatter || null;
  return (
    <div className={classnames('sea-metadata-ui cell-formatter-container tags-formatter', className)}>
      <div className="sea-metadata-ui-tags-container">
        {value.map((item) => {
          const tag = getRowById(tagsData, item);
          const tagColor = tag.color;
          if (!showName) {
            return (
              <span key={item} className="sea-metadata-tag-color" style={{ backgroundColor: tagColor }}></span>
            );
          }
          return (
            <Tag tag={tag} key={item} />
          );
        })}
      </div>
    </div>
  );
};

TagsFormatter.propTypes = {
  value: PropTypes.array,
  tagsData: PropTypes.object,
  className: PropTypes.string,
  showName: PropTypes.bool,
};

export default TagsFormatter;
