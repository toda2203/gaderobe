import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Alert,
  Spin,
  Typography,
  List,
  Space,
  Tag,
  Result,
  App,
  Descriptions,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const { Title, Paragraph, Text } = Typography;

interface ConfirmationItem {
  quantity: number;
  name: string;
  size?: string;
  category?: string;
}

interface ConfirmationDetails {
  id: string;
  protocolType: string;
  items: ConfirmationItem[];
  employee: {
    name: string;
    email: string;
  };
  confirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
  expiresAt: string;
  createdAt: string;
}

export default function ConfirmationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { user, isAuthenticated } = useAuthStore();
  
  const [confirmation, setConfirmation] = useState<ConfirmationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Ungültiger Bestätigungslink');
      setLoading(false);
      return;
    }

    fetchConfirmationDetails();
  }, [token]);

  const fetchConfirmationDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/confirmations/${token}`);
      setConfirmation(response.data.data);
    } catch (error: any) {
      console.error('Error fetching confirmation:', error);
      
      if (error.response?.status === 404) {
        setError('Bestätigungslink nicht gefunden oder bereits verwendet.');
      } else if (error.response?.status === 410) {
        setError('Dieser Bestätigungslink ist abgelaufen.');
      } else {
        setError('Fehler beim Laden der Bestätigungsdetails.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmation || !isAuthenticated) return;

    try {
      setConfirming(true);
      await api.post(`/confirmations/${token}/confirm`);
      
      message.success('Erhalt erfolgreich bestätigt!');
      
      // Refresh confirmation details to show updated status
      await fetchConfirmationDetails();
    } catch (error: any) {
      console.error('Error confirming receipt:', error);
      
      if (error.response?.status === 403) {
        message.error('Sie können nur Ihre eigenen Bestätigungen durchführen.');
      } else if (error.response?.status === 400) {
        message.warning('Diese Bestätigung wurde bereits durchgeführt.');
      } else {
        message.error('Fehler bei der Bestätigung. Versuchen Sie es erneut.');
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleLogin = () => {
    // Redirect to login with return URL
    localStorage.setItem('returnUrl', window.location.pathname);
    navigate('/login');
  };

  const getProtocolTypeDisplay = (type: string) => {
    const types = {
      SINGLE: { text: 'Einzelausgabe', color: 'blue' },
      BULK_ISSUE: { text: 'Sammelausgabe', color: 'green' },
      BULK_RETURN: { text: 'Sammelrückgabe', color: 'orange' },
    };
    return types[type as keyof typeof types] || { text: type, color: 'default' };
  };

  const isExpired = confirmation ? new Date(confirmation.expiresAt) < new Date() : false;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>Lade Bestätigungsdetails...</Text>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '50px auto' }}>
        <Result
          status="error"
          title="Bestätigungslink ungültig"
          subTitle={error}
          extra={
            <Button type="primary" onClick={() => navigate('/')}>
              Zur Startseite
            </Button>
          }
        />
      </div>
    );
  }

  if (!confirmation) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '50px auto' }}>
        <Result
          status="404"
          title="Bestätigung nicht gefunden"
          subTitle="Der angeforderte Bestätigungslink wurde nicht gefunden."
          extra={
            <Button type="primary" onClick={() => navigate('/')}>
              Zur Startseite
            </Button>
          }
        />
      </div>
    );
  }

  // Already confirmed
  if (confirmation.confirmed) {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '50px auto' }}>
        <Result
          status="success"
          title="Erhalt bestätigt"
          subTitle={`Bestätigt am ${new Date(confirmation.confirmedAt!).toLocaleString('de-DE')}`}
          extra={
            <Space>
              <Button type="primary" onClick={() => navigate('/')}>
                Zur Startseite
              </Button>
            </Space>
          }
        >
          <Card title="Bestätigungsdetails" style={{ textAlign: 'left', marginTop: 24 }}>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Mitarbeiter">
                {confirmation.employee.name}
              </Descriptions.Item>
              <Descriptions.Item label="Protokoll-Art">
                <Tag color={getProtocolTypeDisplay(confirmation.protocolType).color}>
                  {getProtocolTypeDisplay(confirmation.protocolType).text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Bestätigt von">
                {confirmation.employee.name}
              </Descriptions.Item>
              <Descriptions.Item label="Bestätigt am">
                {new Date(confirmation.confirmedAt!).toLocaleString('de-DE')}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Result>
      </div>
    );
  }

  // Expired link
  if (isExpired) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '50px auto' }}>
        <Result
          status="error"
          title="Bestätigungslink abgelaufen"
          subTitle={`Dieser Link ist am ${new Date(confirmation.expiresAt).toLocaleString('de-DE')} abgelaufen.`}
          extra={
            <Space>
              <Button type="primary" onClick={() => navigate('/')}>
                Zur Startseite
              </Button>
              <Button onClick={() => window.location.href = 'mailto:hr@company.com'}>
                HR kontaktieren
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '50px auto' }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={2}>
              <CheckCircleOutlined style={{ color: '#1890ff' }} /> Erhalt bestätigen
            </Title>
            <Paragraph>
              Um den Erhalt zu bestätigen, müssen Sie sich zunächst mit Ihrem Microsoft-Konto anmelden.
            </Paragraph>
          </div>

          <Alert
            message="Anmeldung erforderlich"
            description="Aus Sicherheitsgründen müssen Sie sich mit Ihrem Microsoft-Konto anmelden, um den Erhalt zu bestätigen."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Card title="Zu bestätigende Artikel" style={{ marginBottom: 24 }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Mitarbeiter">
                {confirmation.employee.name}
              </Descriptions.Item>
              <Descriptions.Item label="Protokoll-Art">
                <Tag color={getProtocolTypeDisplay(confirmation.protocolType).color}>
                  {getProtocolTypeDisplay(confirmation.protocolType).text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Gültig bis">
                <Text type="warning">
                  <ClockCircleOutlined /> {new Date(confirmation.expiresAt).toLocaleString('de-DE')}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <List
              style={{ marginTop: 16 }}
              header={<div><strong>Artikel:</strong></div>}
              dataSource={confirmation.items}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Tag color="blue">{item.quantity}x</Tag>
                    <Text strong>{item.name}</Text>
                    {item.size && <Text type="secondary">(Größe: {item.size})</Text>}
                    {item.category && <Tag>{item.category}</Tag>}
                  </Space>
                </List.Item>
              )}
            />
          </Card>

          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<LoginOutlined />}
              onClick={handleLogin}
            >
              Mit Microsoft anmelden
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Authenticated - show confirmation
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '50px auto' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>
            <CheckCircleOutlined style={{ color: '#52c41a' }} /> Erhalt bestätigen
          </Title>
          <Paragraph>
            Bitte prüfen Sie die untenstehenden Artikel und bestätigen Sie den Erhalt.
          </Paragraph>
        </div>

        <Alert
          message={`Angemeldet als: ${user?.firstName} ${user?.lastName}`}
          type="success"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Card title="Zu bestätigende Artikel" style={{ marginBottom: 24 }}>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Empfänger">
              {confirmation.employee.name}
            </Descriptions.Item>
            <Descriptions.Item label="Protokoll-Art">
              <Tag color={getProtocolTypeDisplay(confirmation.protocolType).color}>
                {getProtocolTypeDisplay(confirmation.protocolType).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Erstellt am">
              {new Date(confirmation.createdAt).toLocaleString('de-DE')}
            </Descriptions.Item>
            <Descriptions.Item label="Gültig bis">
              <Text type="warning">
                <ClockCircleOutlined /> {new Date(confirmation.expiresAt).toLocaleString('de-DE')}
              </Text>
            </Descriptions.Item>
          </Descriptions>

          <List
            style={{ marginTop: 16 }}
            header={<div><strong>Erhaltene Artikel:</strong></div>}
            dataSource={confirmation.items}
            renderItem={(item, index) => (
              <List.Item key={index}>
                <Space>
                  <Tag color="blue">{item.quantity}x</Tag>
                  <Text strong>{item.name}</Text>
                  {item.size && <Text type="secondary">(Größe: {item.size})</Text>}
                  {item.category && <Tag>{item.category}</Tag>}
                </Space>
              </List.Item>
            )}
          />
        </Card>

        <Alert
          message="Wichtiger Hinweis"
          description="Mit der Bestätigung erklären Sie, dass Sie die oben aufgelisteten Artikel ordnungsgemäß erhalten haben. Diese Bestätigung wird dauerhaft gespeichert und kann nicht rückgängig gemacht werden."
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <div style={{ textAlign: 'center' }}>
          <Space size="large">
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              loading={confirming}
              onClick={handleConfirm}
            >
              {confirming ? 'Bestätige...' : 'Erhalt bestätigen'}
            </Button>
            <Button size="large" onClick={() => navigate('/')}>
              Abbrechen
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
}