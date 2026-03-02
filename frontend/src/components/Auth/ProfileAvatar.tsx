import React from 'react';
import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';

/**
 * Zeigt ein rundes Profilbild oder Initialen als Platzhalter.
 * @param {string} profileImageUrl - URL zum Profilbild (optional)
 * @param {string} firstName - Vorname (für Initialen)
 * @param {string} lastName - Nachname (für Initialen)
 * @param {number} size - Avatar-Größe (px)
 */
export const ProfileAvatar = ({ profileImageUrl, firstName, lastName, size = 128 }) => {
  const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`;
  const fallbackImg = '/assets/user.png';
  const showFallback = !profileImageUrl;
  return (
    <Avatar
      src={showFallback ? fallbackImg : profileImageUrl}
      size={size}
      icon={showFallback ? <UserOutlined /> : undefined}
      style={{ backgroundColor: '#1890ff', objectFit: 'cover', fontSize: size / 2.5 }}
    >
      {showFallback && initials}
    </Avatar>
  );
};
