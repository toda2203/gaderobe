import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Spin,
  Popconfirm,
  Row,
  Col,
  Card,
  Statistic,
  Tag,
  Switch,
  App,
  Descriptions,
  Tabs,
  Avatar,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

interface Employee {
  id: string;
  entraId?: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  role: 'ADMIN' | 'WAREHOUSE' | 'HR' | 'READ_ONLY';
  status: 'ACTIVE' | 'INACTIVE' | 'LEFT';
  isHidden: boolean;
  createdAt: string;
}

interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  byRole: Array<{ role: string; count: number }>;
  byDepartment: Array<{ department: string; count: number }>;
}

const EmployeesPage: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeItems, setEmployeeItems] = useState<any[]>([]);
  const [employeeTransactions, setEmployeeTransactions] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [searchText, setSearchText] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterDepartment, setFilterDepartment] = useState<string[]>([]);
  const [filterRole, setFilterRole] = useState<string[]>([]);
  const { user } = useAuthStore();
  const canEdit = Boolean(user && user.role !== 'READ_ONLY');

  // Load departments from localStorage
  const [departments, setDepartments] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    const storedDepartments = localStorage.getItem('departments');
    setDepartments(
      (storedDepartments ? JSON.parse(storedDepartments) : [
        'Verkauf',
        'Werkstatt',
        'Verwaltung',
        'Lager',
      ]).map((d: string) => ({ label: d, value: d }))
    );
  }, []);

  // Fetch employees and stats
  const fetchData = async () => {
    try {
      setLoading(true);
      const [employeesRes, statsRes] = await Promise.all([
        api.get('/employees', {
          params: { includeHidden: showHidden },
        }),
        api.get('/employees/stats'),
      ]);

      setEmployees(employeesRes.data.data);
      setStats(statsRes.data.data);
    } catch (error) {
      message.error('Fehler beim Laden der Mitarbeiter');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

  // Apply filters
  useEffect(() => {
    let filtered = employees;

    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (emp) =>
          emp.firstName.toLowerCase().includes(search) ||
          emp.lastName.toLowerCase().includes(search) ||
          emp.email.toLowerCase().includes(search) ||
          emp.department?.toLowerCase().includes(search)
      );
    }

    if (filterStatus.length > 0) {
      filtered = filtered.filter((emp) => filterStatus.includes(emp.status));
    }

    if (filterDepartment.length > 0) {
      filtered = filtered.filter((emp) => emp.department && filterDepartment.includes(emp.department));
    }

    if (filterRole.length > 0) {
      filtered = filtered.filter((emp) => filterRole.includes(emp.role));
    }

    setFilteredEmployees(filtered);
  }, [employees, searchText, filterStatus, filterDepartment, filterRole]);

  // Handle create/edit
  const handleSave = async (values: any) => {
    try {
      if (editingId) {
        // Update
        await api.patch(`/employees/${editingId}`, values);
        message.success('Mitarbeiter aktualisiert');
      } else {
        // Create
        await api.post('/employees', values);
        message.success('Mitarbeiter erstellt');
      }

      setIsModalVisible(false);
      form.resetFields();
      setEditingId(null);
      fetchData();
    } catch (error: any) {
      message.error(
        error.response?.data?.error || 'Fehler beim Speichern des Mitarbeiters'
      );
    }
  };

  // Handle edit
  const handleEdit = (employee: Employee) => {
    form.setFieldsValue({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      department: employee.department,
      role: employee.role,
      status: employee.status,
    });
    setEditingId(employee.id);
    setIsModalVisible(true);
  };

  const handleToggleHidden = async (employee: Employee) => {
    try {
      await api.patch(`/employees/${employee.id}`, { isHidden: !employee.isHidden });
      message.success(
        employee.isHidden ? 'Mitarbeiter wieder eingeblendet' : 'Mitarbeiter ausgeblendet'
      );
      fetchData();
    } catch (error) {
      message.error('Sichtbarkeit konnte nicht geändert werden');
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/employees/${id}`);
      message.success('Mitarbeiter gelöscht');
      fetchData();
    } catch (error) {
      message.error('Fehler beim Löschen des Mitarbeiters');
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingId(null);
  };

  // Show employee details with issued items
  const showEmployeeDetails = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setDetailsModalVisible(true);
    setItemsLoading(true);

    try {
      // Load currently issued items (not returned)
      const currentItemsResponse = await api.get('/transactions', {
        params: { employeeId: employee.id, returned: false },
      });
      
      // Load complete transaction history for protocols
      const allTransactionsResponse = await api.get('/transactions', {
        params: { employeeId: employee.id },
      });
      
      setEmployeeItems(currentItemsResponse.data.data);
      setEmployeeTransactions(allTransactionsResponse.data.data);
    } catch (error) {
      message.error('Fehler beim Laden der Artikel');
      console.error(error);
    } finally {
      setItemsLoading(false);
    }
  };

  // Navigate to clothing item details
  const navigateToClothingItem = (clothingItemId: string) => {
    // Close the current modal
    setDetailsModalVisible(false);
    setSelectedEmployee(null);
    setEmployeeItems([]);
    setEmployeeTransactions([]);
    
    // Navigate to clothing items page with the specific item ID
    navigate(`/clothing?itemId=${clothingItemId}`);
  };

  const columns = [
    {
      title: 'Vorname',
      dataIndex: 'firstName',
      key: 'firstName',
      sorter: (a: Employee, b: Employee) =>
        a.firstName.localeCompare(b.firstName),
    },
    {
      title: 'Nachname',
      dataIndex: 'lastName',
      key: 'lastName',
      sorter: (a: Employee, b: Employee) =>
        a.lastName.localeCompare(b.lastName),
    },
    {
      title: 'E-Mail',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Rolle',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const colors: { [key: string]: string } = {
          ADMIN: 'red',
          WAREHOUSE: 'blue',
          HR: 'green',
          READ_ONLY: 'default',
        };
        return <Tag color={colors[role]}>{role}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: { [key: string]: string } = {
          ACTIVE: 'green',
          INACTIVE: 'orange',
          LEFT: 'red',
        };
        return <Tag color={colors[status]}>{status}</Tag>;
      },
    },
    {
      title: 'Sichtbarkeit',
      dataIndex: 'isHidden',
      key: 'isHidden',
      render: (isHidden: boolean) => (
        <Tag color={isHidden ? 'default' : 'green'}>
          {isHidden ? 'Ausgeblendet' : 'Sichtbar'}
        </Tag>
      ),
    },
    {
      title: 'Aktion',
      key: 'action',
      render: (_: any, record: Employee) => (
        <Space size="middle">
          <Button
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => showEmployeeDetails(record)}
          >
            Details
          </Button>
          {canEdit && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                Bearbeiten
              </Button>
              <Button
                size="small"
                icon={record.isHidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                onClick={() => handleToggleHidden(record)}
              >
                {record.isHidden ? 'Einblenden' : 'Ausblenden'}
              </Button>
              <Popconfirm
                title="Mitarbeiter löschen?"
                description="Sind Sie sicher?"
                onConfirm={() => handleDelete(record.id)}
                okText="Ja"
                cancelText="Nein"
              >
                <Button danger size="small" icon={<DeleteOutlined />}>
                  Löschen
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  // Download protocol function
  const downloadProtocol = async (transactionId: string, type: 'issue' | 'return') => {
    try {
      const response = await api.get(`/reports/transaction/${transactionId}/protocol`, {
        params: { type },
        responseType: 'blob',
      });

      // Create blob link to download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filename = type === 'issue' ? `Ausgabe-${transactionId}.pdf` : `Ruecknahme-${transactionId}.pdf`;
      link.setAttribute('download', filename);
      
      // Append to html link element page
      document.body.appendChild(link);
      
      // Start download
      link.click();
      
      // Clean up and remove the link
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success(`${type === 'issue' ? 'Ausgabe' : 'Rücknahme'}protokoll heruntergeladen`);
    } catch (error: any) {
      console.error('Error downloading protocol:', error);
      
      if (error.response?.status === 403) {
        message.error('Ausgabeprotokoll kann erst nach bestätigtem Erhalt durch den Mitarbeiter erstellt werden');
      } else if (error.response?.status === 404) {
        message.error('Transaktion nicht gefunden');
      } else {
        message.error('Fehler beim Herunterladen des Protokolls');
      }
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1>Mitarbeiterverwaltung</h1>
      </div>

      {/* Statistics */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card>
              <Statistic title="Gesamt" value={stats.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Aktiv"
                value={stats.active}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Inaktiv"
                value={stats.inactive}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Abteilungen"
                value={stats.byDepartment.length}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Toolbar */}
      <div style={{ marginBottom: '16px' }}>
        <Space wrap>
          {/* Mitarbeiter können nur über Entra-Sync angelegt werden */}
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchData}
            loading={loading}
          >
            Aktualisieren
          </Button>
          
          {canEdit && (
            <Button
              type="primary"
              onClick={async () => {
                try {
                  message.loading('Synchronisiere mit Microsoft Entra...', 0);
                  await api.post('/sync/employees');
                  message.destroy();
                  message.success('Entra ID Synchronisation abgeschlossen');
                  fetchData();
                } catch (error: any) {
                  message.destroy();
                  message.error('Fehler bei der Synchronisation: ' + (error.response?.data?.error || 'Unbekannter Fehler'));
                }
              }}
            >
              🔄 Mit Entra ID synchronisieren
            </Button>
          )}
          
          {canEdit && (
            <Switch
              checked={showHidden}
              onChange={setShowHidden}
              checkedChildren="Verborgene anzeigen"
              unCheckedChildren="Verborgene ausblenden"
            />
          )}
        </Space>
      </div>

      {/* Search and Filter */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Input.Search
              placeholder="Suche (Name, Email, Abteilung)"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              mode="multiple"
              placeholder="Nach Status filtern"
              value={filterStatus}
              onChange={(value) => setFilterStatus(value || [])}
              allowClear
              style={{ width: '100%' }}
              maxTagCount={1}
              maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
              options={[
                { label: 'Aktiv', value: 'ACTIVE' },
                { label: 'Inaktiv', value: 'INACTIVE' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              mode="multiple"
              placeholder="Nach Abteilung filtern"
              value={filterDepartment}
              onChange={(value) => setFilterDepartment(value || [])}
              allowClear
              style={{ width: '100%' }}
              maxTagCount={1}
              maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
              options={departments}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              mode="multiple"
              placeholder="Nach Rolle filtern"
              value={filterRole}
              onChange={(value) => setFilterRole(value || [])}
              allowClear
              style={{ width: '100%' }}
              maxTagCount={1}
              maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
              options={[
                { label: 'Admin', value: 'ADMIN' },
                { label: 'HR', value: 'HR' },
                { label: 'Lager', value: 'WAREHOUSE' },
                { label: 'Nur Lesezugriff', value: 'READ_ONLY' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button
              onClick={() => {
                setSearchText('');
                setFilterStatus([]);
                setFilterDepartment([]);
                setFilterRole([]);
              }}
            >
              Filter zurücksetzen
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={filteredEmployees}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
          onRow={(record) => ({
            onDoubleClick: () => showEmployeeDetails(record),
          })}
        />
      </Spin>

      {/* Modal */}
      <Modal
        title="Mitarbeiter bearbeiten"
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={handleModalClose}
        okText="Speichern"
        cancelText="Abbrechen"
      >
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
          <strong>Hinweis:</strong> Mitarbeiterstammdaten werden automatisch aus Microsoft Entra synchronisiert. 
          Hier können nur Rolle und Status bearbeitet werden.
        </div>
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            label="Vorname (aus Entra ID)"
            name="firstName"
            rules={[
              { required: true, message: 'Vorname ist erforderlich' },
            ]}
          >
            <Input disabled style={{ backgroundColor: '#f5f5f5' }} />
          </Form.Item>

          <Form.Item
            label="Nachname (aus Entra ID)"
            name="lastName"
            rules={[
              { required: true, message: 'Nachname ist erforderlich' },
            ]}
          >
            <Input disabled style={{ backgroundColor: '#f5f5f5' }} />
          </Form.Item>

          <Form.Item
            label="E-Mail (aus Entra ID)"
            name="email"
            rules={[
              { required: true, message: 'E-Mail ist erforderlich' },
              { type: 'email', message: 'Ungültige E-Mail' },
            ]}
          >
            <Input disabled style={{ backgroundColor: '#f5f5f5' }} />
          </Form.Item>

          <Form.Item
            label="Department (aus Entra ID)"
            name="department"
            rules={[
              { required: true, message: 'Department ist erforderlich' },
            ]}
          >
            <Select
              disabled
              placeholder="Wählen Sie ein Department"
              options={departments}
              style={{ backgroundColor: '#f5f5f5' }}
            />
          </Form.Item>

          <Form.Item
            label="Nachname"
            name="lastName"
            rules={[
              { required: true, message: 'Nachname ist erforderlich' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="E-Mail"
            name="email"
            rules={[
              { required: true, message: 'E-Mail ist erforderlich' },
              { type: 'email', message: 'Ungültige E-Mail' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Department"
            name="department"
            rules={[
              { required: true, message: 'Department ist erforderlich' },
            ]}
          >
            <Select
              placeholder="Wählen Sie ein Department"
              options={departments}
            />
          </Form.Item>

          <Form.Item
            label="Rolle"
            name="role"
            rules={[
              { required: true, message: 'Rolle ist erforderlich' },
            ]}
          >
            <Select
              placeholder="Wählen Sie eine Rolle"
              options={[
                { label: 'Admin', value: 'ADMIN' },
                { label: 'Lager', value: 'WAREHOUSE' },
                { label: 'HR', value: 'HR' },
                { label: 'Nur Lesen', value: 'READ_ONLY' },
              ]}
            />
          </Form.Item>

          {editingId && (
            <Form.Item
              label="Status"
              name="status"
              rules={[
                { required: true, message: 'Status ist erforderlich' },
              ]}
            >
              <Select
                placeholder="Wählen Sie einen Status"
                options={[
                  { label: 'Aktiv', value: 'ACTIVE' },
                  { label: 'Inaktiv', value: 'INACTIVE' },
                  { label: 'Ausgetreten', value: 'LEFT' },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Employee Details Modal */}
      <Modal
        title={selectedEmployee ? `Mitarbeiter Details: ${selectedEmployee.firstName} ${selectedEmployee.lastName}` : 'Mitarbeiter Details'}
        open={detailsModalVisible}
        onCancel={() => {
          setDetailsModalVisible(false);
          setSelectedEmployee(null);
          setEmployeeItems([]);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailsModalVisible(false)}>
            Schließen
          </Button>
        ]}
        width={1200}
      >
        <Spin spinning={itemsLoading}>
          {selectedEmployee && (
            <Tabs
              items={[
                {
                  key: 'overview',
                  label: 'Übersicht',
                  children: (
                    <Row gutter={24}>
                      <Col span={12}>
                        <Card title="Persönliche Informationen" size="small">
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                            <Avatar size={64} style={{ backgroundColor: '#1890ff', marginRight: '16px' }}>
                              {selectedEmployee.firstName?.charAt(0)}{selectedEmployee.lastName?.charAt(0)}
                            </Avatar>
                            <div>
                              <h3 style={{ margin: 0 }}>
                                {selectedEmployee.firstName} {selectedEmployee.lastName}
                              </h3>
                              <p style={{ margin: 0, color: '#666' }}>{selectedEmployee.email}</p>
                            </div>
                          </div>
                          
                          <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="Vorname">
                              {selectedEmployee.firstName}
                            </Descriptions.Item>
                            <Descriptions.Item label="Nachname">
                              {selectedEmployee.lastName}
                            </Descriptions.Item>
                            <Descriptions.Item label="E-Mail">
                              {selectedEmployee.email}
                            </Descriptions.Item>
                            <Descriptions.Item label="Abteilung">
                              {selectedEmployee.department || <span style={{ color: '#999' }}>Nicht zugeordnet</span>}
                            </Descriptions.Item>
                            <Descriptions.Item label="Status">
                              <Tag color={
                                selectedEmployee.status === 'ACTIVE' ? 'green' :
                                selectedEmployee.status === 'INACTIVE' ? 'orange' : 'red'
                              }>
                                {selectedEmployee.status === 'ACTIVE' ? 'Aktiv' :
                                 selectedEmployee.status === 'INACTIVE' ? 'Inaktiv' : 'Verlassen'}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Rolle">
                              <Tag color={
                                selectedEmployee.role === 'ADMIN' ? 'red' :
                                selectedEmployee.role === 'HR' ? 'purple' :
                                selectedEmployee.role === 'WAREHOUSE' ? 'blue' : 'default'
                              }>
                                {selectedEmployee.role === 'ADMIN' ? 'Administrator' :
                                 selectedEmployee.role === 'HR' ? 'Personalwesen' :
                                 selectedEmployee.role === 'WAREHOUSE' ? 'Lager' : 'Nur Lesezugriff'}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Sichtbar">
                              <Tag color={selectedEmployee.isHidden ? 'orange' : 'green'}>
                                {selectedEmployee.isHidden ? 'Verborgen' : 'Sichtbar'}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Erstellt am">
                              {new Date(selectedEmployee.createdAt).toLocaleString('de-DE')}
                            </Descriptions.Item>
                            {selectedEmployee.entraId && (
                              <Descriptions.Item label="Entra ID">
                                <code style={{ fontSize: '11px' }}>{selectedEmployee.entraId}</code>
                              </Descriptions.Item>
                            )}
                          </Descriptions>
                        </Card>
                      </Col>

                      <Col span={12}>
                        <Card title="Schnellübersicht" size="small">
                          <Row gutter={16}>
                            <Col span={12}>
                              <Statistic 
                                title="Ausgegebene Artikel" 
                                value={employeeItems.length} 
                                valueStyle={{ color: employeeItems.length > 0 ? '#1890ff' : '#999' }}
                              />
                            </Col>
                            <Col span={12}>
                              <Statistic 
                                title="Verschiedene Artikel" 
                                value={new Set(employeeItems.map(item => item.clothingItem.type.name)).size}
                                valueStyle={{ color: '#52c41a' }}
                              />
                            </Col>
                          </Row>
                          
                          {employeeItems.length > 0 && (
                            <div style={{ marginTop: '16px' }}>
                              <h4>Artikel-Typen:</h4>
                              <div>
                                {Array.from(new Set(employeeItems.map(item => item.clothingItem.type.name)))
                                  .map(typeName => (
                                    <Tag key={typeName} style={{ marginBottom: '4px' }}>
                                      {typeName}
                                    </Tag>
                                  ))}
                              </div>
                            </div>
                          )}
                        </Card>
                      </Col>
                    </Row>
                  ),
                },
                {
                  key: 'clothing',
                  label: `Kleidungsstücke (${employeeItems.length})`,
                  children: (
                    <Card title="Aktuell ausgegebene Kleidungsstücke">
                      {employeeItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                          <InfoCircleOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                          <p>Keine Kleidungsstücke ausgegeben</p>
                        </div>
                      ) : (
                        <>
                          <div style={{ marginBottom: '16px', padding: '8px', background: '#f0f9ff', border: '1px solid #bae7ff', borderRadius: '6px' }}>
                            <InfoCircleOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                            <span style={{ color: '#1890ff', fontSize: '12px' }}>
                              Tipp: Doppelklicken Sie auf ein Kleidungsstück, um zu den Details zu springen
                            </span>
                          </div>
                          <Table
                          dataSource={employeeItems}
                          rowKey="id"
                          pagination={false}
                          size="small"
                          onRow={(record) => ({
                            onDoubleClick: () => navigateToClothingItem(record.clothingItem.id),
                            style: { cursor: 'pointer' },
                          })}
                          columns={[
                            {
                              title: 'Artikel',
                              key: 'item',
                              render: (record: any) => (
                                <div>
                                  <div style={{ fontWeight: 'bold' }}>{record.clothingItem.type.name}</div>
                                  <div style={{ fontSize: '12px', color: '#999' }}>
                                    ID: {record.clothingItem.internalId}
                                  </div>
                                  {record.clothingItem.qrCode && (
                                    <div style={{ fontSize: '11px', color: '#ccc' }}>
                                      QR: {record.clothingItem.qrCode}
                                    </div>
                                  )}
                                </div>
                              ),
                            },
                            {
                              title: 'Größe',
                              key: 'size',
                              render: (record: any) => (
                                <Tag color="blue">{record.clothingItem.size}</Tag>
                              ),
                            },
                            {
                              title: 'Kategorie',
                              key: 'category',
                              render: (record: any) => (
                                <Tag color={record.clothingItem.category === 'PERSONALIZED' ? 'purple' : 'cyan'}>
                                  {record.clothingItem.category === 'PERSONALIZED' ? 'Personalisiert' : 'Pool'}
                                </Tag>
                              ),
                            },
                            {
                              title: 'Status',
                              key: 'status',
                              render: (record: any) => (
                                <Tag color={
                                  record.clothingItem.status === 'ISSUED' ? 'green' :
                                  record.clothingItem.status === 'PENDING' ? 'orange' : 'default'
                                }>
                                  {record.clothingItem.status === 'ISSUED' ? 'Ausgegeben' :
                                   record.clothingItem.status === 'PENDING' ? 'Ausstehend' : 
                                   record.clothingItem.status}
                                </Tag>
                              ),
                            },
                            {
                              title: 'Ausgegeben am',
                              dataIndex: 'issuedAt',
                              key: 'issuedAt',
                              render: (date: string) => new Date(date).toLocaleString('de-DE'),
                            },
                            {
                              title: 'Zustand bei Ausgabe',
                              dataIndex: 'conditionOnIssue',
                              key: 'condition',
                              render: (condition: string) => {
                                const labels: Record<string, string> = {
                                  NEW: 'Neu',
                                  GOOD: 'Gut',
                                  WORN: 'Getragen',
                                  RETIRED: 'Ausgemustert',
                                };
                                const colors: Record<string, string> = {
                                  NEW: 'green',
                                  GOOD: 'blue', 
                                  WORN: 'orange',
                                  RETIRED: 'red',
                                };
                                return <Tag color={colors[condition]}>{labels[condition] || condition}</Tag>;
                              },
                            },
                            {
                              title: 'Ausgegeben von',
                              key: 'issuedBy',
                              render: (record: any) => record.issuedBy ? 
                                `${record.issuedBy.firstName} ${record.issuedBy.lastName}` : 
                                'System',
                            },
                          ]}
                        />
                        </>
                      )}
                    </Card>
                  ),
                },
                {
                  key: 'protocols',
                  label: 'Protokolle',
                  children: (
                    <Card title="Verfügbare Protokolle">
                      {employeeTransactions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                          <InfoCircleOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                          <p>Keine Transaktionen vorhanden - keine Protokolle verfügbar</p>
                        </div>
                      ) : (
                        <Table
                          dataSource={employeeTransactions.flatMap(transaction => {
                            const protocols = [];
                            
                            // Issue protocol
                            protocols.push({
                              key: `${transaction.id}-issue`,
                              transactionId: transaction.id,
                              type: 'issue',
                              date: transaction.issuedAt,
                              clothingItem: `${transaction.clothingItem.type.name} (${transaction.clothingItem.internalId})`,
                              processor: transaction.issuedBy ? `${transaction.issuedBy.firstName} ${transaction.issuedBy.lastName}` : 'System',
                              title: 'Ausgabeprotokoll',
                              available: true, // Issue protocols are available after confirmation
                            });
                            
                            // Return protocol (if returned)
                            if (transaction.returnedAt && transaction.returnedBy) {
                              protocols.push({
                                key: `${transaction.id}-return`,
                                transactionId: transaction.id,
                                type: 'return',
                                date: transaction.returnedAt,
                                clothingItem: `${transaction.clothingItem.type.name} (${transaction.clothingItem.internalId})`,
                                processor: `${transaction.returnedBy.firstName} ${transaction.returnedBy.lastName}`,
                                title: 'Rücknahmeprotokoll',
                                available: true, // Return protocols are always available
                              });
                            }
                            
                            return protocols;
                          }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
                          columns={[
                            {
                              title: 'Datum',
                              dataIndex: 'date',
                              key: 'date',
                              render: (date: string) => new Date(date).toLocaleString('de-DE'),
                            },
                            {
                              title: 'Protokollart',
                              dataIndex: 'title',
                              key: 'title',
                              render: (title: string, record: any) => (
                                <Tag color={record.type === 'issue' ? 'green' : 'orange'}>
                                  {title}
                                </Tag>
                              ),
                            },
                            {
                              title: 'Kleidungsstück',
                              dataIndex: 'clothingItem',
                              key: 'clothingItem',
                            },
                            {
                              title: 'Bearbeiter',
                              dataIndex: 'processor',
                              key: 'processor',
                            },
                            {
                              title: 'Status',
                              dataIndex: 'available',
                              key: 'status',
                              render: (available: boolean) => (
                                <Tag color={available ? 'green' : 'red'}>
                                  {available ? 'Verfügbar' : 'Nicht verfügbar'}
                                </Tag>
                              ),
                            },
                            {
                              title: 'Aktion',
                              key: 'action',
                              render: (text: string, record: any) => (
                                <Button
                                  type="primary"
                                  size="small"
                                  icon={<DownloadOutlined />}
                                  onClick={() => downloadProtocol(record.transactionId, record.type)}
                                  disabled={!record.available}
                                >
                                  Download
                                </Button>
                              ),
                            },
                          ]}
                          pagination={false}
                          size="small"
                        />
                      )}
                    </Card>
                  ),
                },
              ]}
            />
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default EmployeesPage;
