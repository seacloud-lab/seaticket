import React, { useMemo } from 'react';
import classnames from 'classnames';
import { Link } from '@gatsbyjs/reach-router';
import { siteRoot, gettext, isDefaultAdmin } from '@/constants';

const UsersNav = ({ currentItem }) => {
  const navList = useMemo(() => {
    return [
      { name: 'database', urlPart: 'users', text: gettext('Database') },
      isDefaultAdmin ? { name: 'admin', urlPart: 'users/admins', text: gettext('Admins') } : null,
    ].filter(item => item);
  }, []);

  return (
    <ul className="nav">
      {navList.map((item, index) => {
        return (
          <li className={classnames('nav-item', { 'active': currentItem === item.name })} key={index}>
            <Link
              to={`${siteRoot}sys/${item.urlPart}/`}
              className={classnames('nav-link pt-0 pb-0', { 'active': currentItem === item.name })}
            >
              {item.text}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

export default UsersNav;
