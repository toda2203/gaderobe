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
  Collapse,
  Modal,
  Checkbox,
  Tooltip,
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
  InfoCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

interface DashboardWidget {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

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
  inactiveEmployeesWithItems: {
    total: number;
    employees: Array<{
      id: string;
      name: string;
      email: string;
      itemCount: number;
      items: Array<{
        id: string;
        internalId: string;
        status: string;
        typeName: string;
      }>;
    }>;
  };
  employeesWithoutClothing: {
    total: number;
    employees: Array<{
      id: string;
      name: string;
      email: string;
      department: string;
    }>;
  };
  pendingConfirmations: {
    total: number;
    confirmations: Array<{
      id: string;
      protocolType: string;
      employee: {
        name: string;
        email: string;
      };
      expiresAt: string;
      createdAt: string;
    }>;
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
  const [configModalVisible, setConfigModalVisible] = useState(false);

  // Default Widget Konfiguration
  const defaultWidgets: DashboardWidget[] = [
    { id: 'kpis', label: 'KPI-Karten', visible: true, order: 1 },
    { id: 'topTypes', label: 'Top 5 Kleidungstypen', visible: true, order: 2 },
    { id: 'recentTransactions', label: 'Letzte Transaktionen', visible: true, order: 3 },
    { id: 'statusOverview', label: 'Status-Übersicht', visible: true, order: 4 },
    { id: 'inactiveEmployees', label: 'Inaktive Mitarbeiter mit Kleidung', visible: true, order: 5 },
    { id: 'employeesWithoutClothing', label: 'Mitarbeiter ohne Kleidung', visible: true, order: 6 },
    { id: 'pendingConfirmations', label: 'Ausstehende Bestätigungen', visible: true, order: 7 },
  ];

  // Widget-Konfiguration laden/speichern
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    try {
      const saved = localStorage.getItem('dashboard_widgets');
      if (saved) {
        const savedWidgets = JSON.parse(saved);
        // Merge mit default widgets um neue Widgets hinzuzufügen
        return defaultWidgets.map(w => savedWidgets.find((s: DashboardWidget) => s.id === w.id) || w);
      }
      return defaultWidgets;
    } catch {
      return defaultWidgets;
    }
  });

  // Benutzer-Präferenzen (localStorage)
  const [viewMode, setViewMode] = useState<'compact' | 'comfortable'>(
    (localStorage.getItem('dashboard_viewMode') as 'compact' | 'comfortable') || 'comfortable'
  );
  const [showHiddenNoClothing, setShowHiddenNoClothing] = useState(
    localStorage.getItem('dashboard_showHiddenNoClothing') === 'true'
  );
  const [hiddenNoClothingIds, setHiddenNoClothingIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('dashboard_hiddenNoClothingIds') || '[]');
    } catch {
      return [];
    }
  });

  // Speichere Präferenzen
  useEffect(() => {
    localStorage.setItem('dashboard_viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('dashboard_widgets', JSON.stringify(widgets));
  }, [widgets]);

  // Helper Functions für Widget Management
  const isWidgetVisible = (id: string) => {
    const widget = widgets.find(w => w.id === id);
    return widget?.visible ?? true;
  };

  const toggleWidgetVisibility = (id: string) => {
    setWidgets(widgets.map(w => 
      w.id === id ? { ...w, visible: !w.visible } : w
    ));
  };

  const moveWidget = (id: string, direction: 'up' | 'down') => {
    // Erstelle eine sortierte Kopie der Widgets
    const sorted = [...widgets].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex(w => w.id === id);
    
    if (direction === 'up' && index > 0) {
      // Tausche die Widgets
      const temp = sorted[index];
      sorted[index] = sorted[index - 1];
      sorted[index - 1] = temp;
    } else if (direction === 'down' && index < sorted.length - 1) {
      // Tausche die Widgets
      const temp = sorted[index];
      sorted[index] = sorted[index + 1];
      sorted[index + 1] = temp;
    }
    
    // Aktualisiere die order-Nummern
    const updated = sorted.map((w, i) => ({ ...w, order: i + 1 }));
    setWidgets(updated);
  };


  useEffect(() => {
    localStorage.setItem('dashboard_showHiddenNoClothing', showHiddenNoClothing.toString());
  }, [showHiddenNoClothing]);

  useEffect(() => {
    localStorage.setItem('dashboard_hiddenNoClothingIds', JSON.stringify(hiddenNoClothingIds));
  }, [hiddenNoClothingIds]);

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

  const { Panel } = Collapse;

  const getTransactionTypeTag = (type: string) => {
    const config: Record<string, { color: string; text: string }> = {
      ISSUE: { color: 'blue', text: 'Ausgabe' },
      RETURN: { color: 'green', text: 'Rücknahme' },
      REPLACE: { color: 'orange', text: 'Ersatz' },
      ADJUSTMENT: { color: 'purple', text: 'Korrektur' },
    };
    return config[type] || { color: 'default', text: type };
  };

  const getProtocolTypeLabel = (type: string) => {
    const types: Record<string, { text: string; color: string }> = {
      SINGLE: { text: 'Einzelausgabe', color: 'blue' },
      BULK_ISSUE: { text: 'Sammelausgabe', color: 'green' },
      BULK_RETURN: { text: 'Sammelrückgabe', color: 'orange' },
    };
    return types[type] || { text: type, color: 'default' };
  };

  const isHiddenNoClothing = (id: string) => hiddenNoClothingIds.includes(id);

  const hideNoClothingEmployee = (id: string) => {
    if (!hiddenNoClothingIds.includes(id)) {
      setHiddenNoClothingIds([...hiddenNoClothingIds, id]);
    }
  };

  const unhideNoClothingEmployee = (id: string) => {
    setHiddenNoClothingIds(hiddenNoClothingIds.filter((itemId) => itemId !== id));
  };

  // Sortierte Widgets für Rendering
  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  // Helper: Widget-Wrapper
  const renderWidget = (widgetId: string, content: React.ReactNode) => {
    if (!isWidgetVisible(widgetId)) return null;
    const widget = widgets.find(w => w.id === widgetId);
    return (
      <div key={widgetId} style={{ order: widget?.order ?? 999 }}>
        {content}
      </div>
    );
  };

  return (
    <div style={{ 
      padding: viewMode === 'compact' ? '16px' : '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
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

            {/* Ansichtseinstellungen / Widget-Konfiguration */}
            <Button 
              icon={<SettingOutlined />}
              onClick={() => setConfigModalVisible(true)}
            >
              Layout anpassen
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Widget-Konfigurationsmodal */}
      <Modal
        title="Dashboard Layout anpassen"
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        onOk={() => setConfigModalVisible(false)}
        width={600}
        footer={[
          <Button key="reset" onClick={() => {
            setWidgets(defaultWidgets);
            setConfigModalVisible(false);
          }}>
            Zurücksetzen
          </Button>,
          <Button key="ok" type="primary" onClick={() => setConfigModalVisible(false)}>
            OK
          </Button>,
        ]}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text type="secondary">
            Aktivieren/deaktivieren Sie Widgets mit der Checkbox und ändern Sie die Reihenfolge mit den Pfeiltasten.
          </Text>
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <List
            dataSource={sortedWidgets}
            renderItem={(widget, index) => (
              <List.Item
                style={{
                  padding: '12px',
                  borderBottom: '1px solid #f0f0f0',
                  backgroundColor: widget.visible ? 'transparent' : '#fafafa',
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Checkbox
                      checked={widget.visible}
                      onChange={() => toggleWidgetVisibility(widget.id)}
                    />
                  }
                  title={
                    <span style={{ 
                      color: widget.visible ? 'inherit' : '#999',
                      textDecoration: widget.visible ? 'none' : 'line-through' 
                    }}>
                      {widget.label}
                    </span>
                  }
                  style={{ margin: 0 }}
                />
                <Space>
                  <Button
                    size="small"
                    icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={() => moveWidget(widget.id, 'up')}
                    title="Nach oben"
                  />
                  <Button
                    size="small"
                    icon={<ArrowDownOutlined />}
                    disabled={index === sortedWidgets.length - 1}
                    onClick={() => moveWidget(widget.id, 'down')}
                    title="Nach unten"
                  />
                </Space>
              </List.Item>
            )}
          />
        </div>
      </Modal>

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
      {renderWidget('kpis', (
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
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
      ))}

      {/* Charts and Lists */}
      {renderWidget('topTypes', (
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
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
      </Row>
      ))}

      {renderWidget('recentTransactions', (
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24} lg={12}>
          <Card
            title="Letzte Transaktionen"
            extra={<ClockCircleOutlined />}
          hoverable
            onClick={() => navigate('/clothing-types')}
            style={{ cursor: 'pointer' }}
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
      </Row>
      ))}

      {renderWidget('inactiveEmployees', (
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24}>
          <Collapse defaultActiveKey={[]} expandIconPosition="end" collapsible="header">
            <Panel
              key="inactive-with-items"
              header={
                <Space>
                  <Text strong>Inaktive Mitarbeiter mit Kleidung</Text>
                  <Tag color={data.inactiveEmployeesWithItems.total > 0 ? 'orange' : 'green'}>
                    {data.inactiveEmployeesWithItems.total}
                  </Tag>
                  <Tooltip title="Nur INAKTIV mit ausgegebener Kleidung. AUSGETRETEN wird nicht angezeigt.">
                    <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                  </Tooltip>
                </Space>
              }
              extra={
                <Button
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate('/employees');
                  }}
                >
                  Mitarbeiter öffnen
                </Button>
              }
            >
              {data.inactiveEmployeesWithItems.total === 0 ? (
                <Text type="secondary">Keine offenen Rückgaben bei inaktiven Mitarbeitern.</Text>
              ) : (
                <List
                  dataSource={data.inactiveEmployeesWithItems.employees}
                  renderItem={(employee) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text>{employee.name}</Text>
                            <Tag color="orange">{employee.itemCount} Stück</Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <Text type="secondary">{employee.email}</Text>
                            <Space wrap>
                              {employee.items.map((item) => (
                                <Tag key={item.id} color="blue">
                                  {item.typeName} · {item.internalId}
                                </Tag>
                              ))}
                            </Space>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Panel>
            {isWidgetVisible('employeesWithoutClothing') && (
            <Panel
              key="employees-without-clothing"
              header={
                <Space>
                  <Text strong>Mitarbeiter ohne Kleidung</Text>
                  <Tag color={data.employeesWithoutClothing.total > 0 ? 'orange' : 'green'}>
                    {data.employeesWithoutClothing.total}
                  </Tag>
                </Space>
              }
              extra={
                <Space size="small" onClick={(event) => event.stopPropagation()}>
                  <Text type="secondary">Ausgeblendete anzeigen</Text>
                  <Switch
                    size="small"
                    checked={showHiddenNoClothing}
                    onChange={setShowHiddenNoClothing}
                  />
                </Space>
              }
            >
              {data.employeesWithoutClothing.total === 0 ? (
                <Text type="secondary">Alle aktiven Mitarbeiter haben bereits Kleidung.</Text>
              ) : (
                <List
                  dataSource={data.employeesWithoutClothing.employees.filter((employee) =>
                    showHiddenNoClothing ? true : !isHiddenNoClothing(employee.id)
                  )}
                  locale={{ emptyText: 'Alle Einträge sind ausgeblendet.' }}
                  renderItem={(employee) => (
                    <List.Item
                      actions={[
                        isHiddenNoClothing(employee.id) ? (
                          <Button size="small" onClick={() => unhideNoClothingEmployee(employee.id)}>
                            Einblenden
                          </Button>
                        ) : (
                          <Button size="small" onClick={() => hideNoClothingEmployee(employee.id)}>
                            Ausblenden
                          </Button>
                        ),
                      ]}
                    >
                      <List.Item.Meta
                        title={<Text>{employee.name}</Text>}
                        description={
                          <Space direction="vertical" size={0}>
                            <Text type="secondary">{employee.email}</Text>
                            <Text type="secondary">Abteilung: {employee.department}</Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Panel>
            )}
          </Collapse>
        </Col>
      </Row>
      ))}

      {/* Ausstehende Bestätigungen */}
      {renderWidget('pendingConfirmations', (
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24}>
          <Card
            title="Ausstehende Bestätigungen"
            extra={
              <Space>
                <Tag color={data.pendingConfirmations.total > 0 ? 'orange' : 'green'}>
                  {data.pendingConfirmations.total}
                </Tag>
                <Button size="small" onClick={() => navigate('/transactions')}>
                  Transaktionen öffnen
                </Button>
              </Space>
            }
          hoverable
            onClick={() => navigate('/transactions')}
            style={{ cursor: 'pointer' }}
          >
            {data.pendingConfirmations.total === 0 ? (
              <Text type="secondary">Keine ausstehenden Bestätigungen.</Text>
            ) : (
              <List
                dataSource={data.pendingConfirmations.confirmations}
                renderItem={(conf) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text>{conf.employee.name}</Text>
                          <Tag color={getProtocolTypeLabel(conf.protocolType).color}>
                            {getProtocolTypeLabel(conf.protocolType).text}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary">{conf.employee.email}</Text>
                          <Text type="secondary">
                            Fällig bis: {dayjs(conf.expiresAt).format('DD.MM.YYYY HH:mm')}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
      ))}

      {/* Status Overview */}
      {renderWidget('statusOverview', (
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col xs={24}>
          <Card 
            title="Status-Übersicht"
            hoverable
            onClick={() => navigate('/clothing-items')}
            style={{ cursor: 'pointer' }}
          >
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
      ))}
    </div>
  );
};

export default DashboardPage;
