import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Select,
  Spin,
  Card,
  Row,
  Col,
  Space,
  Statistic,
  Tag,
  Avatar,
  Descriptions,
  Tabs,
  Popconfirm
} from 'antd';
import { PlusOutlined, DownloadOutlined, ReloadOutlined, InfoCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';
import { ProfileAvatar } from '../components/Auth/ProfileAvatar';

interface Employee {
  id: number;
  name: string;
  email: string;
  isHidden: boolean;
  firstName?: string;
  lastName?: string;
  department?: string;
  role?: string;
  status?: string;
  createdAt?: string;
  entraId?: string;
  profileImageUrl?: string;
}

import { useAuthStore } from '@store/authStore';
import { useNavigate } from 'react-router-dom';
import { useMasterData } from '../hooks/useMasterData';

const Employees: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  useEffect(() => {
    if (user && (user.role === 'READ_ONLY' || user.role === 'WAREHOUSE')) {
      navigate('/');
    }
  }, [user, navigate]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  // Entfernt: modalVisible, setModalVisible
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterDepartment, setFilterDepartment] = useState<string[]>([]);
  const [filterRole, setFilterRole] = useState<string[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>(employees);
  // Entfernt: isModalVisible, setIsModalVisible, editingId
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState<boolean>(false);
  const [employeeItems, setEmployeeItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState<boolean>(false);
  const [employeeTransactions, setEmployeeTransactions] = useState<any[]>([]);
  // Dummy canEdit value for demonstration
  const canEdit = true;

  // State für Passwort-Feedback
  const [passwordChanged, setPasswordChanged] = useState<boolean>(false);
  const masterData = useMasterData();

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (masterData.departments && masterData.departments.length > 0) {
      setDepartments(masterData.departments.map((dept: string) => ({ label: dept, value: dept })));
    }
  }, [masterData.departments]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await api.get('/employees');
      let data = Array.isArray(response.data?.data) ? response.data.data : [];
      // Mapping: name aus firstName + lastName zusammensetzen
      data = Array.isArray(data)
        ? data.map((emp: any) => ({
            ...emp,
            name: [emp.firstName, emp.lastName].filter(Boolean).join(' ')
          }))
        : [];
      setEmployees(Array.isArray(data) ? data : []);
      setFilteredEmployees(Array.isArray(data) ? data : []);
      console.log('Geladene Mitarbeiter:', data);
    } catch (error) {
      message.error('Fehler beim Laden der Mitarbeiter');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsEditModalVisible(true);
    form.setFieldsValue({ ...employee, password: undefined });
  };

  const handleDelete = async (employeeId: any) => {
    try {
      await api.delete(`/employees/${employeeId}`);
      message.success('Mitarbeiter gelöscht');
      fetchEmployees();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Fehler beim Löschen');
    }
  };

  const handleAdd = () => {
    setEditingEmployee(null);
    setIsAddModalVisible(true);
    form.resetFields();
  };

  // Entfernt: handleModalClose (wird nicht mehr benötigt)

  /**
   * Speichert Mitarbeiterdaten und setzt/ändert optional das Passwort.
   * Wenn ein Passwort im Formular gesetzt ist, wird es über die API an /auth/set-password geschickt.
   * Danach werden die restlichen Mitarbeiterdaten gespeichert.
   * Nach erfolgreicher Änderung wird das Passwortfeld geleert und Feedback angezeigt.
   */
  const handleSave = async (values?: any) => {
    try {
      const formValues = values || (await form.validateFields());
      const saveValues = { ...formValues };
      if (formValues.password) {
        saveValues.passwordPlain = formValues.password;
      }
      delete saveValues.password;
      let response;
      if (editingEmployee && editingEmployee.id) {
        response = await api.patch(`/employees/${editingEmployee.id}`, saveValues);
        message.success('Mitarbeiter aktualisiert');
        setIsEditModalVisible(false);
      } else {
        response = await api.post('/employees', saveValues);
        message.success('Mitarbeiter angelegt');
        setIsAddModalVisible(false);
      }
      setEditingEmployee(null);
      form.resetFields();
      fetchEmployees();
      setPasswordChanged(false);
      form.setFieldsValue({ password: undefined });
    } catch (error: any) {
      const backendMsg = error?.response?.data?.error || error?.message;
      if (backendMsg && backendMsg.includes('E-Mail bereits vergeben')) {
        message.error('Diese E-Mail-Adresse ist bereits vergeben. Bitte wähle eine andere.');
      } else {
        message.error('Fehler beim Speichern');
      }
    }
  };

  const handleSaveAndSend = async () => {
    try {
      const formValues = await form.validateFields();
      const saveValues = { ...formValues, sendCredentials: true };
      if (formValues.password) {
        saveValues.passwordPlain = formValues.password;
      }
      delete saveValues.password;
      let response;
      if (editingEmployee && editingEmployee.id) {
        response = await api.patch(`/employees/${editingEmployee.id}`, saveValues);
        message.success('Mitarbeiter aktualisiert und Zugangsdaten versendet');
        setIsEditModalVisible(false);
      } else {
        response = await api.post('/employees', saveValues);
        message.success('Mitarbeiter hinzugefügt und Zugangsdaten versendet');
        setIsAddModalVisible(false);
      }
      setEditingEmployee(null);
      form.resetFields();
      fetchEmployees();
      setPasswordChanged(false);
      form.setFieldsValue({ password: undefined });
      if (response?.data?.error) {
        throw new Error(response.data.error);
      }
    } catch (error: any) {
      const backendMsg = error?.response?.data?.error || error?.message;
      if (backendMsg && backendMsg.includes('E-Mail bereits vergeben')) {
        message.error('Diese E-Mail-Adresse ist bereits vergeben. Bitte wähle eine andere.');
      } else {
        message.error('Fehler beim Speichern: ' + backendMsg);
      }
    }
  };

  // State für separate Modale
  const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);

  // Table columns definition
  const columns = [
    { 
      title: 'Name', 
      dataIndex: 'name', 
      key: 'name',
      render: (_: any, record: Employee) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ProfileAvatar
            profileImageUrl={record.profileImageUrl}
            firstName={record.firstName}
            lastName={record.lastName}
            size={32}
          />
          {record.name}
        </span>
      )
    },
    { title: 'E-Mail', dataIndex: 'email', key: 'email' },
    { title: 'Abteilung', dataIndex: 'department', key: 'department' },
    { title: 'Rolle', dataIndex: 'role', key: 'role', render: (role: string) => {
        switch (role) {
          case 'ADMIN': return <Tag color="red">Admin</Tag>;
          case 'HR': return <Tag color="purple">HR</Tag>;
          case 'WAREHOUSE': return <Tag color="blue">Lager</Tag>;
          case 'READ_ONLY': return <Tag>Nur Lesezugriff</Tag>;
          default: return <Tag>{role}</Tag>;
        }
      }
    },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => {
        switch (status) {
          case 'ACTIVE': return <Tag color="green">Aktiv</Tag>;
          case 'INACTIVE': return <Tag color="orange">Inaktiv</Tag>;
          case 'LEFT': return <Tag color="red">Ausgetreten</Tag>;
          default: return <Tag>{status}</Tag>;
        }
      }
    },
    {
      title: 'Sichtbar',
      dataIndex: 'isHidden',
      key: 'isHidden',
      render: (isHidden: boolean) =>
        <Tag color={isHidden ? 'orange' : 'green'}>{isHidden ? 'Verborgen' : 'Sichtbar'}</Tag>
    },
    {
      title: 'Aktion',
      key: 'action',
      render: (_: any, record: Employee) => (
        <Space size="small">
          <Button type="link" onClick={() => handleEdit(record)}>Bearbeiten</Button>
          <Popconfirm
            title="Mitarbeiter löschen?"
            description={record.status === 'LEFT' ? 'Dieser Mitarbeiter wird permanent gelöscht.' : 'Der Status wird auf "LEFT" gesetzt.'}
            okText="Ja"
            cancelText="Nein"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>Löschen</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // filtering logic — example implementation (adapt for your actual employee structure)
  useEffect(() => {
    let filtered = employees;
    if (searchText) {
      filtered = filtered.filter(emp =>
        (emp.name ?? '').toLowerCase().includes(searchText.toLowerCase()) ||
        (emp.email ?? '').toLowerCase().includes(searchText.toLowerCase()) ||
        (emp.department ?? '').toLowerCase().includes(searchText.toLowerCase())
      );
    }
    if (filterStatus.length > 0) {
      filtered = filtered.filter(emp => filterStatus.includes(emp.status ?? ''));
    }
    if (filterDepartment.length > 0) {
      filtered = filtered.filter(emp => filterDepartment.includes(emp.department ?? ''));
    }
    if (filterRole.length > 0) {
      filtered = filtered.filter(emp => filterRole.includes(emp.role ?? ''));
    }
    setFilteredEmployees(Array.isArray(filtered) ? filtered : []);
  }, [employees, searchText, filterStatus, filterDepartment, filterRole]);
  // Handlers — some are dummies for demonstration purposes
  const showEmployeeDetails = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDetailsModalVisible(true);
    // Dummy loading
    setItemsLoading(true);
    // Dummy employeeItems and transactions (replace with actual API call)
    setTimeout(() => {
      setEmployeeItems([]);
      setEmployeeTransactions([]);
      setItemsLoading(false);
    }, 500);
  };

  const generateRandomPassword = () =>
    Math.random().toString(36).slice(-8);

  const downloadProtocol = (transactionId: number, type: string) => {
    // Dummy download handler
    message.success(`Protokoll ${transactionId} heruntergeladen (${type})`);
  };

  // Correction: All <Modal> attributes use "open" instead of "visible"
  // Correction: The render and handler structure is syntactically correct

  return (
    <div>
      <h2>Mitarbeiter</h2>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        style={{ marginBottom: 16 }}
      >
        Mitarbeiter hinzufügen
      </Button>
      {/* Die Haupttabelle wird weiter unten gerendert, doppelte Tabellen entfernt */}
      <Modal
        title="Mitarbeiter anlegen"
        open={isAddModalVisible}
        onCancel={() => {
          setIsAddModalVisible(false);
          setEditingEmployee(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Speichern"
        cancelText="Abbrechen"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            label="Vorname"
            name="firstName"
            rules={[{ required: true, message: 'Vorname ist erforderlich' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Nachname"
            name="lastName"
            rules={[{ required: true, message: 'Nachname ist erforderlich' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="E-Mail"
            name="email"
            rules={[{ required: true, message: 'Bitte E-Mail eingeben' }]}
          >
            <Input type="email" />
          </Form.Item>
          <Form.Item
            label="Kennwort"
            name="password"
            rules={[{ required: !editingEmployee, message: 'Kennwort ist erforderlich' }]}
          >
            <Input.Password
              addonAfter={
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    const randomPassword = generateRandomPassword();
                    form.setFieldsValue({ password: randomPassword });
                    setPasswordChanged(true);
                  }}
                  type="default"
                  size="small"
                  title="Zufallskennwort generieren"
                />
              }
              onChange={e => {
                // Nur auf true setzen, wenn das Feld nicht leer ist und sich vom Ursprungswert unterscheidet
                const value = e.target.value;
                if (editingEmployee && value && value !== "") {
                  setPasswordChanged(true);
                } else if (!value || value === "") {
                  setPasswordChanged(false);
                }
              }}
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item
            label="Department"
            name="department"
            rules={[{ required: true, message: 'Department ist erforderlich' }]}
          >
            <Select
              placeholder="Wählen Sie ein Department"
              options={departments}
            />
          </Form.Item>
          <Form.Item
            label="Rolle"
            name="role"
            rules={[{ required: true, message: 'Rolle ist erforderlich' }]}
          >
            <Select
              placeholder="Wählen Sie eine Rolle"
              options={[
                { label: 'Admin', value: 'ADMIN' },
                { label: 'HR', value: 'HR' },
                { label: 'Lager', value: 'WAREHOUSE' },
                { label: 'Nur Lesezugriff', value: 'READ_ONLY' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: 'Status ist erforderlich' }]}
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
        </Form>
      </Modal>

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

      {/* Table: Nur eine Haupttabelle */}
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
        open={isEditModalVisible}
        onCancel={() => {
          setIsEditModalVisible(false);
          setEditingEmployee(null);
          form.resetFields();
        }}
        footer={[
          <Button key="save-only" type="default"
            disabled={!!form.getFieldValue('password')}
            onClick={async () => {
              try {
                const values = await form.validateFields();
                if (!values.password) delete values.password;
                await handleSave({ ...values, password: undefined });
                message.success('Mitarbeiter aktualisiert');
              } catch (err) {
                // Validierungsfehler werden ignoriert, keine weitere Aktion nötig
              }
            }}>
            Speichern
          </Button>,
          <Button key="save-send" type="primary" onClick={handleSaveAndSend}>
            Speichern und Zugangsdaten versenden
          </Button>,
        ]}
        width={1200}
      >
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>

        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            label="Vorname"
            name="firstName"
            rules={[{ required: true, message: 'Vorname ist erforderlich' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Nachname"
            name="lastName"
            rules={[{ required: true, message: 'Nachname ist erforderlich' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="E-Mail"
            name="email"
            rules={[{ required: true, message: 'Bitte E-Mail eingeben' }]}
          >
            <Input type="email" />
          </Form.Item>
          <Form.Item
            label="Kennwort"
            name="password"
            rules={[{ required: !editingEmployee, message: 'Kennwort ist erforderlich' }]}
          >
            <Input.Password
              addonAfter={
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    const randomPassword = generateRandomPassword();
                    form.setFieldsValue({ password: randomPassword });
                    setPasswordChanged(true);
                  }}
                  type="default"
                  size="small"
                  title="Zufallskennwort generieren"
                />
              }
              onChange={() => setPasswordChanged(true)}
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item
            label="Department"
            name="department"
            rules={[{ required: true, message: 'Department ist erforderlich' }]}
          >
            <Select
              placeholder="Wählen Sie ein Department"
              options={departments}
            />
          </Form.Item>
          <Form.Item
            label="Rolle"
            name="role"
            rules={[{ required: true, message: 'Rolle ist erforderlich' }]}
          >
            <Select
              placeholder="Wählen Sie eine Rolle"
              options={[
                { label: 'Admin', value: 'ADMIN' },
                { label: 'HR', value: 'HR' },
                { label: 'Lager', value: 'WAREHOUSE' },
                { label: 'Nur Lesezugriff', value: 'READ_ONLY' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: 'Status ist erforderlich' }]}
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
                            <ProfileAvatar
                              profileImageUrl={selectedEmployee.profileImageUrl}
                              firstName={selectedEmployee.firstName}
                              lastName={selectedEmployee.lastName}
                              size={64}
                            />
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
                              {selectedEmployee.createdAt && new Date(selectedEmployee.createdAt).toLocaleString('de-DE')}
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
                                value={new Set(employeeItems.map(item => item.clothingItem?.type?.name)).size}
                                valueStyle={{ color: '#52c41a' }}
                              />
                            </Col>
                          </Row>
                          {employeeItems.length > 0 && (
                            <div style={{ marginTop: '16px' }}>
                              <h4>Artikel-Typen:</h4>
                              <div>
                                {Array.from(new Set(employeeItems.map(item => item.clothingItem?.type?.name)))
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
                              clothingItem: `${transaction.clothingItem?.type?.name} (${transaction.clothingItem?.internalId})`,
                              processor: transaction.issuedBy ? `${transaction.issuedBy.firstName} ${transaction.issuedBy.lastName}` : 'System',
                              title: 'Ausgabeprotokoll',
                              available: true,
                            });
                            // Return protocol (if returned)
                            if (transaction.returnedAt && transaction.returnedBy) {
                              protocols.push({
                                key: `${transaction.id}-return`,
                                transactionId: transaction.id,
                                type: 'return',
                                date: transaction.returnedAt,
                                clothingItem: `${transaction.clothingItem?.type?.name} (${transaction.clothingItem?.internalId})`,
                                processor: `${transaction.returnedBy.firstName} ${transaction.returnedBy.lastName}`,
                                title: 'Rücknahmeprotokoll',
                                available: true,
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
                              render: (_: any, record: any) => (
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

export default Employees;