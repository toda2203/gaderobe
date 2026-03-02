import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, Button, message, Tooltip, Upload, Avatar } from 'antd';
import { ReloadOutlined, EditOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
// Hilfsfunktion für Bild-URL (Profilbild oder Platzhalter)
function getProfileImageUrl(profileData) {
  if (profileData?.profileImageUrl) return profileData.profileImageUrl;
  return '/assets/user.png';
}

function generateRandomPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export const ProfileModal = ({ visible, onClose }) => {
  const { user, setUser } = useAuthStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(user);
  const [editField, setEditField] = useState(null); // Feldname, das gerade editiert wird

  // Beim Öffnen: Userdaten immer frisch vom Backend holen
  useEffect(() => {
    const fetchProfile = async () => {
      if (visible && user?.id) {
        try {
          const res = await api.get(`/employees/${user.id}`);
          setProfileData(res.data.data);
          form.setFieldsValue(res.data.data);
        } catch (err) {
          message.error('Profil konnte nicht geladen werden');
        }
      } else if (!visible) {
        form.resetFields();
      }
    };
    fetchProfile();
  }, [visible, user?.id, form]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      let input = { ...values };
      input.profileImageUrl = profileData?.profileImageUrl;
      if (values.password) {
        input.passwordPlain = values.password;
      }
      const res = await api.patch(`/employees/${user.id}`, input);
      message.success('Profil erfolgreich aktualisiert');
      setUser(res.data);
      setProfileData(res.data);
      setTimeout(() => {
        try {
          onClose();
        } catch (closeError) {
          message.error('Profil gespeichert, aber das Modal konnte nicht geschlossen werden.');
          // eslint-disable-next-line no-console
          console.error('Fehler beim Schließen des Modals:', closeError);
        }
      }, 800);
    } catch (error) {
      // Nur Backend-Fehler anzeigen
      if (error?.response?.data?.error) {
        message.error(error.response.data.error);
      } else if (error?.isAxiosError) {
        message.error('Fehler beim Speichern');
      } else {
        // Validierungsfehler oder andere Fehler nicht als Toast anzeigen
        // Optional: console.log(error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Profilbild Upload-Handler
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post(`/employees/upload-profile-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfileData((prev) => ({ ...prev, profileImageUrl: res.data.url }));
      setUser({ ...user, profileImageUrl: res.data.url });
      message.success('Profilbild aktualisiert');
    } catch (err) {
      message.error('Fehler beim Hochladen des Profilbilds');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title="Profil bearbeiten"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="save" type="primary" loading={loading} onClick={handleSave}>Speichern</Button>,
        <Button key="cancel" onClick={onClose}>Abbrechen</Button>
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
        <Avatar
          src={getProfileImageUrl(profileData)}
          size={128}
          icon={<UserOutlined />}
          style={{ marginBottom: 8, border: '2px solid #eee', background: '#fff', objectFit: 'cover' }}
        />
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={e => {
            if (e.target.files && e.target.files[0]) handleImageUpload(e.target.files[0]);
          }}
        />
        <Button
          icon={<UploadOutlined />}
          loading={uploading}
          size="small"
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >Bild ändern</Button>
      </div>
      <Form form={form} layout="vertical">
        <Form.Item label="Vorname" name="firstName" rules={[{ required: true, message: 'Vorname ist erforderlich' }]}
        >
          <Input
            readOnly={editField !== 'firstName'}
            onBlur={() => setEditField(null)}
            suffix={
              <Tooltip title="Bearbeiten">
                <Button
                  icon={<EditOutlined />} size="small" type="text"
                  onClick={() => setEditField('firstName')}
                  tabIndex={-1}
                  style={{ marginRight: -8 }}
                />
              </Tooltip>
            }
          />
        </Form.Item>
        <Form.Item label="Nachname" name="lastName" rules={[{ required: true, message: 'Nachname ist erforderlich' }]}
        >
          <Input
            readOnly={editField !== 'lastName'}
            onBlur={() => setEditField(null)}
            suffix={
              <Tooltip title="Bearbeiten">
                <Button
                  icon={<EditOutlined />} size="small" type="text"
                  onClick={() => setEditField('lastName')}
                  tabIndex={-1}
                  style={{ marginRight: -8 }}
                />
              </Tooltip>
            }
          />
        </Form.Item>
        <Form.Item label="E-Mail" name="email" rules={[{ required: true, message: 'E-Mail ist erforderlich' }, { type: 'email', message: 'Ungültige E-Mail' }]}
        >
          <Input
            readOnly={editField !== 'email'}
            onBlur={() => setEditField(null)}
            suffix={
              <Tooltip title="Bearbeiten">
                <Button
                  icon={<EditOutlined />} size="small" type="text"
                  onClick={() => setEditField('email')}
                  tabIndex={-1}
                  style={{ marginRight: -8 }}
                />
              </Tooltip>
            }
          />
        </Form.Item>
        <Form.Item label="Kennwort" name="password">
          <Input.Password
            readOnly={editField !== 'password'}
            addonAfter={
              <Button icon={<ReloadOutlined />} onClick={() => { form.setFieldsValue({ password: generateRandomPassword() }); }} type="default" size="small" title="Zufallskennwort generieren" />
            }
            onBlur={() => setEditField(null)}
            suffix={
              <Tooltip title="Bearbeiten">
                <Button
                  icon={<EditOutlined />} size="small" type="text"
                  onClick={() => setEditField('password')}
                  tabIndex={-1}
                  style={{ marginRight: -8 }}
                />
              </Tooltip>
            }
            autoComplete="new-password"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
