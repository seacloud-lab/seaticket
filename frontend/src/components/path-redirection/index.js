import React, { Fragment } from 'react';
import classnames from 'classnames';
import IconButton from '../icon-button';
import { isFunction } from '@/utils/type-detection';

import './index.css';

const PathsRedirection = ({
  paths,
}) => {
  if (!Array.isArray(paths) || paths.length === 0) return null;
  const lastPathIndex = paths.length - 1;
  return (
    <div className="sea-ticket-paths-redirection">
      {paths.map((path, index) => {
        const { name, callback } = path;
        const isValidCallback = isFunction(callback);
        return (
          <Fragment key={index}>
            <div
              className={classnames('sea-ticket-paths-redirection-name text-truncate', { 'redirection': isValidCallback })}
              onClick={isValidCallback ? callback : () => {}}
              title={name}
            >
              {name}
            </div>
            {index !== lastPathIndex && (
              <IconButton className="sea-ticket-paths-redirection-icon rotate-icon-270 no-hover-bg mx-2" icon="arrow-down" />
            )}
          </Fragment>
        );
      })}
    </div>
  );
};

export default PathsRedirection;
