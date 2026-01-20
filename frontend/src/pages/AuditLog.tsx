import React, { useEffect, useState } from 'react';
import { Table, Card, Tag, Button, Space, DatePicker, Select, Input, message, Modal } from 'antd';
import { ReloadOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import api from '../services/api';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedById: string;
  performedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  changes: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

interface AuditLogResponse {
  success: boolean;
  data: {
    logs: AuditLogEntry[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  // Filters
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>();
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  
  // Modal for detailed view
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = async (page = 1, limit = 50) => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
      };

      if (entityTypeFilter) params.entityType = entityTypeFilter;
      if (actionFilter) params.action = actionFilter;
      if (dateRange) {
        params.startDate = dateRange[0].toISOString();
        params.endDate = dateRange[1].toISOString();
      }

      const response = await api.get<AuditLogResponse>('/system/audit-logs', { params });
      
      if (response.data.success) {
        setLogs(response.data.data.logs);
        setPagination({
          current: response.data.data.pagination.page,
          pageSize: response.data.data.pagination.limit,
          total: response.data.data.pagination.total,
        });
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Fehler beim Laden der Audit Logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    fetchLogs(newPagination.current || 1, newPagination.pageSize || 50);
  };

  const handleSearch = () => {
    fetchLogs(1, pagination.pageSize);
  };

  const handleReset = () => {
    setEntityTypeFilter(undefined);
    setActionFilter(undefined);
    setDateRange(null);
    setPagination({ ...pagination, current: 1 });
    fetchLogs(1, pagination.pageSize);
  };

  const handleShowDetails = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setDetailsModalVisible(true);
  };

  const formatChanges = (changes: string | null) => {
    if (!changes) return null;
    try {
      return JSON.parse(changes);
    } catch {
      return changes;
    }
  };

  const getActionColor = (action: string): string => {
    const colors: Record<string, string> = {
      CREATE: 'green',
      UPDATE: 'blue',
      DELETE: 'red',
      PERMANENT_DELETE: 'magenta',
      ISSUE: 'cyan',
      RETURN: 'orange',
      RETIRE: 'purple',
      CONFIRM: 'geekblue',
    };
    return colors[action] || 'default';
  };

  const getEntityTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      ClothingItem: 'Kleidungsstück',
      ClothingType: 'Kleidungstyp',
      Transaction: 'Transaktion',
      Employee: 'Mitarbeiter',
      Confirmation: 'Bestätigung',
    };
    return labels[type] || type;
  };

  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: 'Zeitstempel',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: string) => dayjs(timestamp).format('DD.MM.YYYY HH:mm:ss'),
    },
    {
      title: 'Benutzer',
      key: 'performedBy',
      width: 200,
      render: (_, record) => (
        <div>
          <div>{`${record.performedBy.firstName} ${record.performedBy.lastName}`}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{record.performedBy.email}</div>
        </div>
      ),
    },
    {
      title: 'Aktion',
      dataIndex: 'action',
      key: 'action',
      width: 150,
      render: (action: string) => (
        <Tag color={getActionColor(action)}>{action}</Tag>
      ),
    },
    {
      title: 'Entitätstyp',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 150,
      render: (type: string) => getEntityTypeLabel(type),
    },
    {
      title: 'Entitäts-ID',
      dataIndex: 'entityId',
      key: 'entityId',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Änderungen',
      dataIndex: 'changes',
      key: 'changes',
      width: 300,
      ellipsis: true,
      render: (changes: string | null, record: AuditLogEntry) => {
        if (!changes) return '-';
        return (
          <Space>
            <div style={{ fontSize: '12px', fontFamily: 'monospace', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {changes.substring(0, 50)}...
            </div>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleShowDetails(record)}
            >
              Details
            </Button>
          </Space>
        );
      },
    },
    {
      title: 'IP-Adresse',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 130,
      render: (ip: string | null) => ip || '-',
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title="Audit Log"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchLogs(pagination.current, pagination.pageSize)}
          >
            Aktualisieren
          </Button>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Filter */}
          <Card size="small" title="Filter">
            <Space wrap>
              <Select
                placeholder="Entitätstyp"
                style={{ width: 200 }}
                allowClear
                value={entityTypeFilter}
                onChange={setEntityTypeFilter}
              >
                <Option value="ClothingItem">Kleidungsstück</Option>
                <Option value="ClothingType">Kleidungstyp</Option>
                <Option value="Transaction">Transaktion</Option>
                <Option value="Employee">Mitarbeiter</Option>
                <Option value="Confirmation">Bestätigung</Option>
              </Select>

              <Select
                placeholder="Aktion"
                style={{ width: 200 }}
                allowClear
                value={actionFilter}
                onChange={setActionFilter}
              >
                <Option value="CREATE">CREATE</Option>
                <Option value="UPDATE">UPDATE</Option>
                <Option value="DELETE">DELETE</Option>
                <Option value="PERMANENT_DELETE">PERMANENT_DELETE</Option>
                <Option value="ISSUE">ISSUE</Option>
                <Option value="RETURN">RETURN</Option>
                <Option value="RETIRE">RETIRE</Option>
                <Option value="CONFIRM">CONFIRM</Option>
              </Select>

              <RangePicker
                format="DD.MM.YYYY"
                placeholder={['Von Datum', 'Bis Datum']}
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
              />

              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
              >
                Filtern
              </Button>

              <Button onClick={handleReset}>
                Zurücksetzen
              </Button>
            </Space>
          </Card>

          {/* Table */}
          <Table
            columns={columns}
            dataSource={logs}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `Gesamt ${total} Einträge`,
              pageSizeOptions: ['10', '25', '50', '100'],
            }}
            onChange={handleTableChange}
            scroll={{ x: 1200 }}
          />
        </Space>
      </Card>

      {/* Details Modal */}
      <Modal
        title="Audit Log Details"
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsModalVisible(false)}>
            Schließen
          </Button>,
        ]}
        width={800}
      >
        {selectedLog && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card size="small" title="Allgemeine Informationen">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div><strong>Zeitstempel:</strong> {dayjs(selectedLog.timestamp).format('DD.MM.YYYY HH:mm:ss')}</div>
                <div><strong>Benutzer:</strong> {`${selectedLog.performedBy.firstName} ${selectedLog.performedBy.lastName}`} ({selectedLog.performedBy.email})</div>
                <div><strong>Aktion:</strong> <Tag color={getActionColor(selectedLog.action)}>{selectedLog.action}</Tag></div>
                <div><strong>Entitätstyp:</strong> {getEntityTypeLabel(selectedLog.entityType)}</div>
                <div><strong>Entitäts-ID:</strong> {selectedLog.entityId}</div>
                {selectedLog.ipAddress && <div><strong>IP-Adresse:</strong> {selectedLog.ipAddress}</div>}
                {selectedLog.userAgent && <div><strong>User Agent:</strong> {selectedLog.userAgent}</div>}
              </Space>
            </Card>

            {selectedLog.changes && (
              <Card size="small" title="Änderungen">
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: '12px', 
                  borderRadius: '4px',
                  maxHeight: '400px',
                  overflow: 'auto',
                  fontSize: '13px',
                  fontFamily: 'Monaco, Consolas, monospace'
                }}>
                  {JSON.stringify(formatChanges(selectedLog.changes), null, 2)}
                </pre>
              </Card>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default AuditLogPage;
