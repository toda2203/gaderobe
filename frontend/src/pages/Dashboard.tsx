import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Spin,
  List,
  Tag,
  Space,
  Button,
  Dropdown,
  Segmented,
  Switch,
} from 'antd';
import {
  UserOutlined,
  ShoppingOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  SettingOutlined,
  FileTextOutlined,
  TeamOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

interface DashboardData {
  items: {
    total: number;
    active: number;
    issued: number;
    retired: number;
  };
  employees: {
    total: number;
    active: number;
  };
  types: {
    total: number;
    active: number;
  };
  value: {
    total: number;
    active: number;
  };
  topTypes: Array<{
    typeId: string;
    name: string;
    count: number;
    costPrice: number;
  }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    employeeName: string;
    itemNumber: string;
    typeName: string;
    createdAt: string;
  }>;
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  // Benutzer-Präferenzen (localStorage)
  const [viewMode, setViewMode] = useState<'compact' | 'comfortable'>(
    (localStorage.getItem('dashboard_viewMode') as 'compact' | 'comfortable') || 'comfortable'
  );
  const [showKPIs, setShowKPIs] = useState(
    localStorage.getItem('dashboard_showKPIs') !== 'false'
  );
  const [showTopTypes, setShowTopTypes] = useState(
    localStorage.getItem('dashboard_showTopTypes') !== 'false'
  );
  const [showRecentTransactions, setShowRecentTransactions] = useState(
    localStorage.getItem('dashboard_showRecentTransactions') !== 'false'
  );
  const [showStatusOverview, setShowStatusOverview] = useState(
    localStorage.getItem('dashboard_showStatusOverview') !== 'false'
  );

  // Speichere Präferenzen
  useEffect(() => {
    localStorage.setItem('dashboard_viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('dashboard_showKPIs', showKPIs.toString());
  }, [showKPIs]);

  useEffect(() => {
    localStorage.setItem('dashboard_showTopTypes', showTopTypes.toString());
  }, [showTopTypes]);

  useEffect(() => {
    localStorage.setItem('dashboard_showRecentTransactions', showRecentTransactions.toString());
  }, [showRecentTransactions]);

  useEffect(() => {
    localStorage.setItem('dashboard_showStatusOverview', showStatusOverview.toString());
  }, [showStatusOverview]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/system/dashboard-stats');
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Fehler beim Laden der Dashboard-Daten';
      console.error('Dashboard fetch error:', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <Text>Keine Daten verfügbar</Text>
        </Card>
      </div>
    );
  }

  const getTransactionTypeTag = (type: string) => {
    const config: Record<string, { color: string; text: string }> = {
      ISSUE: { color: 'blue', text: 'Ausgabe' },
      RETURN: { color: 'green', text: 'Rücknahme' },
      REPLACE: { color: 'orange', text: 'Ersatz' },
      ADJUSTMENT: { color: 'purple', text: 'Korrektur' },
    };
    return config[type] || { color: 'default', text: type };
  };

  return (
    <div style={{ padding: viewMode === 'compact' ? '16px' : '24px' }}>
      {/* Header mit Titel und Aktionen */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
        </Col>
        <Col>
          <Space wrap size="middle">
            {/* Ansichtsmodus */}
            <Segmented
              options={[
                { label: 'Kompakt', value: 'compact' },
                { label: 'Komfortabel', value: 'comfortable' },
              ]}
              value={viewMode}
              onChange={(value) => setViewMode(value as 'compact' | 'comfortable')}
            />

            {/* Ansichtseinstellungen */}
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'kpis',
                    label: (
                      <Space>
                        {showKPIs ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        KPI-Karten
                        <Switch size="small" checked={showKPIs} />
                      </Space>
                    ),
                    onClick: () => setShowKPIs(!showKPIs),
                  },
                  {
                    key: 'topTypes',
                    label: (
                      <Space>
                        {showTopTypes ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        Top Typen
                        <Switch size="small" checked={showTopTypes} />
                      </Space>
                    ),
                    onClick: () => setShowTopTypes(!showTopTypes),
                  },
                  {
                    key: 'recentTransactions',
                    label: (
                      <Space>
                        {showRecentTransactions ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        Letzte Transaktionen
                        <Switch size="small" checked={showRecentTransactions} />
                      </Space>
                    ),
                    onClick: () => setShowRecentTransactions(!showRecentTransactions),
                  },
                  {
                    key: 'statusOverview',
                    label: (
                      <Space>
                        {showStatusOverview ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        Status-Übersicht
                        <Switch size="small" checked={showStatusOverview} />
                      </Space>
                    ),
                    onClick: () => setShowStatusOverview(!showStatusOverview),
                  },
                ],
              }}
              placement="bottomRight"
            >
              <Button icon={<SettingOutlined />}>Ansicht</Button>
            </Dropdown>
          </Space>
        </Col>
      </Row>

      {/* Quick-Access Buttons für Tablet */}
      <Card style={{ marginBottom: '16px' }} bodyStyle={{ padding: '12px' }}>
        <Row gutter={[8, 8]} wrap>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Button
              type="primary"
              block
              size="large"
              icon={<PlusOutlined />}
              onClick={() => navigate('/clothing-items')}
              style={{ height: viewMode === 'compact' ? '48px' : '56px' }}
            >
              Neues Item
            </Button>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Button
              type="default"
              block
              size="large"
              icon={<SwapOutlined />}
              onClick={() => navigate('/transactions')}
              style={{ height: viewMode === 'compact' ? '48px' : '56px' }}
            >
              Transaktion
            </Button>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Button
              type="default"
              block
              size="large"
              icon={<TeamOutlined />}
              onClick={() => navigate('/employees')}
              style={{ height: viewMode === 'compact' ? '48px' : '56px' }}
            >
              Mitarbeiter
            </Button>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Button
              type="default"
              block
              size="large"
              icon={<AppstoreOutlined />}
              onClick={() => navigate('/clothing-types')}
              style={{ height: viewMode === 'compact' ? '48px' : '56px' }}
            >
              Typen
            </Button>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Button
              type="default"
              block
              size="large"
              icon={<FileTextOutlined />}
              onClick={() => navigate('/reports')}
              style={{ height: viewMode === 'compact' ? '48px' : '56px' }}
            >
              Berichte
            </Button>
          </Col>
          {user?.role === 'ADMIN' && (
            <Col xs={12} sm={8} md={6} lg={4}>
              <Button
                type="default"
                block
                size="large"
                icon={<SettingOutlined />}
                onClick={() => navigate('/settings')}
                style={{ height: viewMode === 'compact' ? '48px' : '56px' }}
              >
                Einstellungen
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {/* KPI Cards */}
      {showKPIs && (
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/clothing-items')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="Kleidungsstücke"
              value={data.items.total}
              prefix={<ShoppingOutlined />}
              suffix={
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  gesamt
                </Text>
              }
              valueStyle={{ fontSize: viewMode === 'compact' ? '20px' : '24px' }}
            />
            <div style={{ marginTop: '12px' }}>
              <Text type="secondary">Verfügbar: {data.items.active}</Text>
              <br />
              <Text type="secondary">Ausgegeben: {data.items.issued}</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/employees')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="Mitarbeiter"
              value={data.employees.active}
              prefix={<UserOutlined />}
              suffix={
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  aktiv
                </Text>
              }
              valueStyle={{ fontSize: viewMode === 'compact' ? '20px' : '24px' }}
            />
            <div style={{ marginTop: '12px' }}>
              <Text type="secondary">Gesamt: {data.employees.total}</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/clothing-types')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="Kleidungstypen"
              value={data.types.active}
              prefix={<AppstoreOutlined />}
              suffix={
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  aktiv
                </Text>
              }
            />
            <div style={{ marginTop: '12px' }}>
              <Text type="secondary">Gesamt: {data.types.total}</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Gesamtwert"
              value={data.value.total}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="€"
            />
            <div style={{ marginTop: '12px' }}>
              <Text type="secondary">Aktiv: {data.value.active.toFixed(2)} €</Text>
            </div>
          </Card>
        </Col>
      </Row>
      )}

      {/* Charts and Lists */}
      {(showTopTypes || showRecentTransactions) && (
      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        {/* Top Types */}
        {showTopTypes && (
        <Col xs={24} lg={12}>
          <Card title="Top 5 Kleidungstypen" extra={<AppstoreOutlined />}>
            <List
              dataSource={data.topTypes}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.name}
                    description={`Kostpreis: ${item.costPrice.toFixed(2)} €`}
                  />
                  <div>
                    <Statistic
                      value={item.count}
                      suffix="Stück"
                      valueStyle={{ fontSize: '16px' }}
                    />
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        )}

        {/* Recent Transactions */}
        {showRecentTransactions && (
        <Col xs={24} lg={12}>
          <Card
            title="Letzte Transaktionen"
            extra={<ClockCircleOutlined />}
          >
            <List
              dataSource={data.recentTransactions}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color={getTransactionTypeTag(item.type).color}>
                          {getTransactionTypeTag(item.type).text}
                        </Tag>
                        <Text>{item.employeeName}</Text>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary">{item.typeName} - {item.itemNumber}</Text>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {dayjs(item.createdAt).format('DD.MM.YYYY HH:mm')}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        )}
      </Row>
      )}

      {/* Status Overview */}
      {showStatusOverview && (
      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24}>
          <Card title="Status-Übersicht">
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="Verfügbare Items"
                    value={data.items.active}
                    valueStyle={{ color: '#52c41a' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="Ausgegebene Items"
                    value={data.items.issued}
                    valueStyle={{ color: '#1890ff' }}
                    prefix={<SwapOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="Ausgemusterte Items"
                    value={data.items.retired}
                    valueStyle={{ color: '#8c8c8c' }}
                    prefix={<ClockCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
      )}
    </div>
  );
};

export default DashboardPage;
