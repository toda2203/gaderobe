import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Button,
  Table,
  Space,
  Tag,
  Modal,
  Row,
  Col,
  Alert,
  Divider,
  App,
  Typography,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiClient } from '../../services/api';

const { Text, Paragraph } = Typography;

interface BackupConfig {
  id: string;
  enabled: boolean;
  schedule: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  hour: number;
  minute: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  retentionDays: number;
  includeImages: boolean;
  includeProtocols: boolean;
  notifyOnSuccess: boolean;
  notifyOnError: boolean;
  notificationEmail?: string;
  lastRunAt?: string;
  lastRunSuccess?: boolean;
  lastRunError?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

const WEEKDAYS = [
  { label: 'Sonntag', value: 0 },
  { label: 'Montag', value: 1 },
  { label: 'Dienstag', value: 2 },
  { label: 'Mittwoch', value: 3 },
  { label: 'Donnerstag', value: 4 },
  { label: 'Freitag', value: 5 },
  { label: 'Samstag', value: 6 },
];

export const AutomaticBackupConfig: React.FC = () => {
  const { message } = App.useApp();
  const [configs, setConfigs] = useState<BackupConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BackupConfig | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/backup-config');
      setConfigs(response.data.data);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Fehler beim Laden der Backup-Konfigurationen';
      console.error('Fetch configs error:', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingConfig(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      frequency: 'DAILY',
      hour: 2,
      minute: 0,
      retentionDays: 30,
      includeImages: true,
      includeProtocols: true,
      notifyOnSuccess: true,
      notifyOnError: true,
    });
    setModalVisible(true);
  };

  const handleEdit = (config: BackupConfig) => {
    setEditingConfig(config);
    form.setFieldsValue(config);
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingConfig) {
        await apiClient.put(`/backup-config/${editingConfig.id}`, values);
        message.success('Backup-Konfiguration aktualisiert');
      } else {
        await apiClient.post('/backup-config', values);
        message.success('Backup-Konfiguration erstellt');
      }
      setModalVisible(false);
      fetchConfigs();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Fehler beim Speichern';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Speichern');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/backup-config/${id}`);
      message.success('Backup-Konfiguration gelöscht');
      fetchConfigs();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Fehler beim Löschen';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Löschen');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await apiClient.post(`/backup-config/${id}/toggle`);
      message.success('Status geändert');
      fetchConfigs();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Fehler beim Ändern des Status';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Ändern des Status');
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      await apiClient.post(`/backup-config/${id}/run-now`);
      message.success('Backup wird ausgeführt...');
      // Refresh after 3 seconds
      setTimeout(fetchConfigs, 3000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Fehler beim Starten des Backups';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Starten des Backups');
    }
  };

  const getFrequencyDisplay = (config: BackupConfig) => {
    const time = `${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')} Uhr`;
    
    switch (config.frequency) {
      case 'DAILY':
        return `Täglich um ${time}`;
      case 'WEEKLY':
        const weekday = WEEKDAYS.find(w => w.value === config.dayOfWeek)?.label || 'Sonntag';
        return `Jeden ${weekday} um ${time}`;
      case 'MONTHLY':
        return `Jeden ${config.dayOfMonth}. des Monats um ${time}`;
      default:
        return config.schedule;
    }
  };

  const columns = [
    {
      title: 'Status',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled: boolean, record: BackupConfig) => (
        <Space direction="vertical" size={0}>
          <Tag color={enabled ? 'success' : 'default'}>
            {enabled ? 'Aktiv' : 'Inaktiv'}
          </Tag>
          {record.lastRunSuccess !== null && (
            <Tag color={record.lastRunSuccess ? 'success' : 'error'} icon={record.lastRunSuccess ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
              {record.lastRunSuccess ? 'OK' : 'Fehler'}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Zeitplan',
      dataIndex: 'frequency',
      key: 'frequency',
      render: (_: any, record: BackupConfig) => (
        <Space direction="vertical" size={0}>
          <Text strong>{getFrequencyDisplay(record)}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.schedule}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Aufbewahrung',
      dataIndex: 'retentionDays',
      key: 'retentionDays',
      width: 120,
      render: (days: number) => `${days} Tage`,
    },
    {
      title: 'Optionen',
      key: 'options',
      width: 120,
      render: (_: any, record: BackupConfig) => (
        <Space direction="vertical" size={0}>
          {record.includeImages && <Tag color="blue">Bilder</Tag>}
          {record.includeProtocols && <Tag color="purple">Protokolle</Tag>}
        </Space>
      ),
    },
    {
      title: 'Benachrichtigungen',
      dataIndex: 'notificationEmail',
      key: 'notifications',
      render: (email: string, record: BackupConfig) => (
        <Space direction="vertical" size={0}>
          {email && <Text style={{ fontSize: '12px' }}>{email}</Text>}
          <Space size={4}>
            {record.notifyOnSuccess && <Tag color="green" style={{ margin: 0, fontSize: '11px' }}>Erfolg</Tag>}
            {record.notifyOnError && <Tag color="red" style={{ margin: 0, fontSize: '11px' }}>Fehler</Tag>}
          </Space>
        </Space>
      ),
    },
    {
      title: 'Letzte Ausführung',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      width: 180,
      render: (lastRunAt: string, record: BackupConfig) => (
        <Space direction="vertical" size={0}>
          {lastRunAt ? (
            <>
              <Text style={{ fontSize: '12px' }}>
                {dayjs(lastRunAt).format('DD.MM.YYYY HH:mm')}
              </Text>
              {record.lastRunError && (
                <Text type="danger" style={{ fontSize: '11px' }}>
                  {record.lastRunError.substring(0, 30)}...
                </Text>
              )}
            </>
          ) : (
            <Text type="secondary">Noch nicht ausgeführt</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Nächste Ausführung',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      width: 150,
      render: (nextRunAt: string) =>
        nextRunAt ? (
          <Text style={{ fontSize: '12px' }}>
            {dayjs(nextRunAt).format('DD.MM.YYYY HH:mm')}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Aktionen',
      key: 'actions',
      fixed: 'right' as const,
      width: 200,
      render: (_: any, record: BackupConfig) => (
        <Space>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleRunNow(record.id)}
            disabled={!record.enabled}
          >
            Jetzt
          </Button>
          <Button
            size="small"
            onClick={() => handleToggle(record.id)}
          >
            {record.enabled ? 'Deaktivieren' : 'Aktivieren'}
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Wirklich löschen?"
            onConfirm={() => handleDelete(record.id)}
            okText="Ja"
            cancelText="Nein"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const frequencyValue = Form.useWatch('frequency', form);

  return (
    <>
      <Alert
        message="Automatische Backups"
        description="Konfigurieren Sie automatische Backups, die nach einem festgelegten Zeitplan erstellt werden. Backups werden im selben Format wie manuelle Backups erstellt."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            <span>Backup-Zeitpläne</span>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Neuer Zeitplan
          </Button>
        }
      >
        <Table
          dataSource={configs}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingConfig ? 'Backup-Zeitplan bearbeiten' : 'Neuer Backup-Zeitplan'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText="Speichern"
        cancelText="Abbrechen"
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Frequenz"
                name="frequency"
                rules={[{ required: true, message: 'Bitte wählen Sie eine Frequenz' }]}
              >
                <Select>
                  <Select.Option value="DAILY">Täglich</Select.Option>
                  <Select.Option value="WEEKLY">Wöchentlich</Select.Option>
                  <Select.Option value="MONTHLY">Monatlich</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Stunde"
                name="hour"
                rules={[{ required: true, message: 'Erforderlich' }]}
              >
                <InputNumber min={0} max={23} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Minute" name="minute">
                <InputNumber min={0} max={59} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {frequencyValue === 'WEEKLY' && (
            <Form.Item
              label="Wochentag"
              name="dayOfWeek"
              rules={[{ required: true, message: 'Bitte wählen Sie einen Wochentag' }]}
            >
              <Select options={WEEKDAYS} />
            </Form.Item>
          )}

          {frequencyValue === 'MONTHLY' && (
            <Form.Item
              label="Tag des Monats"
              name="dayOfMonth"
              rules={[{ required: true, message: 'Bitte wählen Sie einen Tag' }]}
            >
              <InputNumber min={1} max={31} style={{ width: '100%' }} />
            </Form.Item>
          )}

          <Divider />

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Aufbewahrung (Tage)" name="retentionDays">
                <InputNumber min={1} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Email-Benachrichtigung" name="notificationEmail">
                <Input type="email" placeholder="admin@example.com" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Bilder einschließen" name="includeImages" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Protokolle einschließen" name="includeProtocols" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Benachrichtigung bei Erfolg" name="notifyOnSuccess" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Benachrichtigung bei Fehler" name="notifyOnError" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Aktiviert" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
