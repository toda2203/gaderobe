import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Modal,
  App,
  Tag,
  Typography,
  Alert,
  Spin,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  DownloadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiClient } from '../../services/api';

const { Text, Paragraph } = Typography;

interface AutoBackup {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  path: string;
}

interface RestoreResult {
  success: boolean;
  imported: {
    employees: number;
    clothingTypes: number;
    clothingItems: number;
    transactions: number;
    auditLogs: number;
  };
  errors: string[];
  imageValidation?: {
    total: number;
    found: number;
    missing: number;
  };
}

export const RestoreAutomaticBackup: React.FC = () => {
  const { message, modal } = App.useApp();
  const [backups, setBackups] = useState<AutoBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/backup-config/available-backups');
      setBackups(response.data.data);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Fehler beim Laden der Backups';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Laden der Backups');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (backup: AutoBackup) => {
    modal.confirm({
      title: 'Automatisches Backup wiederherstellen?',
      icon: <ExclamationCircleOutlined />,
      content: (
        <>
          <Paragraph>
            Diese Aktion wird alle aktuellen Daten mit den Inhalten aus dem Backup überschreiben:
          </Paragraph>
          <div style={{ background: '#fafafa', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
            <div>📁 Datei: <strong>{backup.filename}</strong></div>
            <div>📅 Erstellt: {dayjs(backup.createdAt).format('DD.MM.YYYY HH:mm:ss')}</div>
            <div>💾 Größe: {backup.sizeFormatted}</div>
          </div>
          <Alert
            message="Warnung!"
            description="Dies kann nicht rückgängig gemacht werden. Stellen Sie sicher, dass Sie ein aktuelles Backup Ihres Systems haben!"
            type="warning"
            showIcon
          />
        </>
      ),
      okText: 'Wiederherstellen',
      okType: 'danger',
      cancelText: 'Abbrechen',
      onOk: () => performRestore(backup),
    });
  };

  const performRestore = async (backup: AutoBackup) => {
    setRestoring(true);
    try {
      const response = await apiClient.post(`/backup-config/restore-backup/${backup.filename}`);
      
      const result: RestoreResult = {
        success: Boolean(response.data?.success),
        imported: response.data?.data || {
          employees: 0,
          clothingTypes: 0,
          clothingItems: 0,
          transactions: 0,
          auditLogs: 0,
        },
        errors: response.data?.errors || [],
        imageValidation: response.data?.imageValidation,
      };

      setRestoreResult(result);
      setShowResultModal(true);
      message.success('Backup erfolgreich wiederhergestellt');
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Fehler beim Wiederherstellen';
      message.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      console.error('Restore error:', error);
    } finally {
      setRestoring(false);
    }
  };

  const columns = [
    {
      title: 'Dateiname',
      dataIndex: 'filename',
      key: 'filename',
      render: (filename: string) => <Text code>{filename}</Text>,
    },
    {
      title: 'Größe',
      dataIndex: 'sizeFormatted',
      key: 'size',
      width: 100,
      render: (size: string) => <Text strong>{size}</Text>,
    },
    {
      title: 'Erstellt am',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => (
        <Text>{dayjs(date).format('DD.MM.YYYY HH:mm:ss')}</Text>
      ),
    },
    {
      title: 'Aktionen',
      key: 'actions',
      fixed: 'right' as const,
      width: 120,
      render: (_: any, record: AutoBackup) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleRestore(record)}
            loading={restoring}
            danger
          >
            Wiederherstellen
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Alert
        message="Achtung!"
        description="Das Wiederherstellen eines Backups überschreibt alle aktuellen Daten mit den Inhalten des Backups. Diese Aktion kann nicht rückgängig gemacht werden!"
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Paragraph style={{ marginBottom: 16 }}>
        Wähle eines der verfügbaren automatischen Backups aus und klicke auf 'Wiederherstellen', um die Datenbank wiederherzustellen.
      </Paragraph>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={backups.map((b, i) => ({ ...b, key: i }))}
          pagination={{ pageSize: 10 }}
          size="middle"
          locale={{ emptyText: 'Keine Backups gefunden' }}
        />
      </Spin>

      {/* Restore Result Modal */}
      <Modal
        title="Wiederherstellung abgeschlossen"
        open={showResultModal}
        onClose={() => setShowResultModal(false)}
        onCancel={() => setShowResultModal(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setShowResultModal(false)}>
            Schließen
          </Button>,
        ]}
        width={600}
      >
        {restoreResult && (
          <>
            {restoreResult.success ? (
              <Alert
                message="Erfolgreich wiederhergestellt"
                type="success"
                icon={<CheckCircleOutlined />}
                showIcon
                style={{ marginBottom: 16 }}
              />
            ) : (
              <Alert
                message="Wiederherstellung mit Fehlern abgeschlossen"
                type="warning"
                icon={<ExclamationCircleOutlined />}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={12}>
                <Card>
                  <Statistic
                    title="Mitarbeiter"
                    value={restoreResult.imported.employees}
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Card>
              </Col>
              <Col xs={12}>
                <Card>
                  <Statistic
                    title="Kleidungstypen"
                    value={restoreResult.imported.clothingTypes}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={12}>
                <Card>
                  <Statistic
                    title="Kleidungsstücke"
                    value={restoreResult.imported.clothingItems}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
              <Col xs={12}>
                <Card>
                  <Statistic
                    title="Transaktionen"
                    value={restoreResult.imported.transactions}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Card>
              </Col>
            </Row>

            {restoreResult.imageValidation && (
              <Card title="Bilder" style={{ marginBottom: 16 }} size="small">
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="Gesamt"
                      value={restoreResult.imageValidation.total}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Gefunden"
                      value={restoreResult.imageValidation.found}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Fehlend"
                      value={restoreResult.imageValidation.missing}
                      valueStyle={{ color: restoreResult.imageValidation.missing > 0 ? '#ff4d4f' : '#52c41a' }}
                    />
                  </Col>
                </Row>
              </Card>
            )}

            {restoreResult.errors.length > 0 && (
              <Card title="Fehler" type="inner" style={{ marginBottom: 16 }}>
                {restoreResult.errors.map((error, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <Tag color="error">{error}</Tag>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}
      </Modal>
    </>
  );
};
