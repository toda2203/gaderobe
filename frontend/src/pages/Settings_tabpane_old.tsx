import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Space,
  Spin,
  Row,
  Col,
  Statistic,
  Divider,
  Alert,
  Tag,
  Tabs,
  List,
  Input,
  Modal,
  Form,
  App,
  Upload,
  Table,
  Typography,
  Image,
} from 'antd';
import type { UploadProps } from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import api from '../services/api';
import { apiClient } from '../services/api';
import { useAuthStore } from '../store/authStore';

const { Title, Text, Paragraph } = Typography;

interface SyncStatus {
  lastSync: string;
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
}

interface DatabaseStats {
  employees: number;
  clothingTypes: number;
  clothingItems: number;
  transactions: number;
  auditLogs: number;
  totalRecords: number;
}

interface ImportResult {
  success: boolean;
  imported: {
    employees: number;
    clothingTypes: number;
    clothingItems: number;
    transactions: number;
    auditLogs: number;
  };
  errors: string[];
}

export default function Settings() {
  const { message } = App.useApp();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploadLoading, setLogoUploadLoading] = useState(false);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const canEdit = user && user.role !== 'READ_ONLY';
  const canExport = user && (user.role === 'ADMIN' || user.role === 'HR');
  const canImport = user && user.role === 'ADMIN';

  // Master data states
  const [categories, setCategories] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'category' | 'size' | 'department'>('category');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [form] = Form.useForm();

  // Fetch sync status
  const fetchSyncStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/sync/status');
      setSyncStatus(response.data.data);
    } catch (error) {
      message.error('Fehler beim Laden des Sync-Status');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/export/stats');
      setStats(response.data.data);
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Fehler beim Laden der Statistiken';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Laden der Statistiken');
      console.error('Stats fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual sync trigger
  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const response = await api.post('/sync/employees', {});
      message.success(
        `Sync erfolgreich! ${response.data.data.created} neue, ${response.data.data.updated} aktualisierte und ${response.data.data.deleted} deaktivierte Mitarbeiter`
      );
      fetchSyncStatus();
    } catch (error: any) {
      message.error(
        error.response?.data?.error || 'Fehler beim Synchronisieren'
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleExportBackup = async () => {
    setExportLoading(true);
    try {
      const response = await apiClient.get('/export/backup', {
        responseType: 'blob',
      });

      const filename =
        response.headers['content-disposition']
          ?.split('filename=')[1]
          ?.replace(/"/g, '') ||
        `bekleidung-backup-${new Date().toISOString().split('T')[0]}.zip`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('Backup-ZIP erfolgreich heruntergeladen');
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Fehler beim Backup-Export';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Backup-Export');
      console.error('Backup export error:', error);
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportFile = async (file: File) => {
    const isZip =
      file.type === 'application/zip' ||
      file.type === 'application/x-zip-compressed' ||
      file.type === 'application/x-zip' ||
      file.name.endsWith('.zip');
    
    if (!isZip) {
      message.error('Sie können nur ZIP-Dateien hochladen!');
      return;
    }

    const isLt50M = file.size / 1024 / 1024 < 50;
    if (!isLt50M) {
      message.error('Die Datei darf nicht größer als 50MB sein!');
      return;
    }

    setImportLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const tempAxios = axios.create({
        baseURL: apiClient.defaults.baseURL || '/api',
      });

      tempAxios.interceptors.request.use(
        (config) => {
          const token = useAuthStore.getState().token;
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          return config;
        },
        (error) => Promise.reject(error)
      );

      const response = await tempAxios.post('/export/import', formData);

      const mapped: ImportResult = {
        success: Boolean(response.data?.success),
        imported: (response.data?.data || {
          employees: 0,
          clothingTypes: 0,
          clothingItems: 0,
          transactions: 0,
          auditLogs: 0,
        }) as ImportResult['imported'],
        errors: (response.data?.errors || []) as string[],
      };
      setImportResult(mapped);
      setShowImportModal(true);
      message.success((response.data?.message as string) || 'Import erfolgreich');
      fetchStats();
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Fehler beim Import';
      message.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      console.error('Import error:', error);
    } finally {
      setImportLoading(false);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.zip',
    showUploadList: false,
    beforeUpload: (file) => {
      handleImportFile(file);
      return false;
    },
  };

  const importColumns = [
    {
      title: 'Kategorie',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: 'Importiert',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => <Typography.Text strong>{count}</Typography.Text>,
    },
  ];

  const getImportTableData = () => {
    if (!importResult) return [];
    return [
      { key: '1', category: 'Mitarbeiter', count: importResult.imported.employees },
      {
        key: '2',
        category: 'Kleidungstypen',
        count: importResult.imported.clothingTypes,
      },
      {
        key: '3',
        category: 'Kleidungsstücke',
        count: importResult.imported.clothingItems,
      },
      {
        key: '4',
        category: 'Transaktionen',
        count: importResult.imported.transactions,
      },
      {
        key: '5',
        category: 'Audit-Logs',
        count: importResult.imported.auditLogs,
      },
    ];
  };

  useEffect(() => {
    fetchSyncStatus();
    loadMasterData();
    loadLogo();
    if (user) {
      fetchStats();
    }
  }, [user?.id]);

  // Load logo from localStorage
  const loadLogo = () => {
    const savedLogo = localStorage.getItem('company_logo');
    setLogoUrl(savedLogo);
  };

  // Handle logo upload
  const handleLogoUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    setLogoUploadLoading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/clothing/items/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const imageUrl = response.data.data.imageUrl;
      setLogoUrl(imageUrl);
      localStorage.setItem('company_logo', imageUrl);
      message.success('Logo erfolgreich hochgeladen');
      
      if (onSuccess) onSuccess(response.data);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Fehler beim Hochladen des Logos');
      if (onError) onError(error);
    } finally {
      setLogoUploadLoading(false);
    }
  };

  // Handle remove logo
  const handleRemoveLogo = async () => {
    if (logoUrl) {
      try {
        await api.delete('/clothing/items/delete-image', {
          data: { imageUrl: logoUrl },
        });
        setLogoUrl(null);
        localStorage.removeItem('company_logo');
        message.success('Logo entfernt');
      } catch (error) {
        console.error('Error removing logo:', error);
      }
    } else {
      setLogoUrl(null);
      localStorage.removeItem('company_logo');
    }
  };

  // Load master data from localStorage
  const loadMasterData = () => {
    const storedCategories = localStorage.getItem('clothing_categories');
    const storedSizes = localStorage.getItem('clothing_sizes');
    const storedDepartments = localStorage.getItem('departments');

    setCategories(storedCategories ? JSON.parse(storedCategories) : [
      'Schuhe',
      'Oberbekleidung',
      'Unterbekleidung',
      'Schutzbekleidung',
      'Accessoires',
      'Sonstiges',
    ]);

    setSizes(storedSizes ? JSON.parse(storedSizes) : [
      'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
      '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50',
    ]);

    setDepartments(storedDepartments ? JSON.parse(storedDepartments) : [
      'Verkauf',
      'Werkstatt',
      'Verwaltung',
      'Lager',
    ]);
  };

  // Save master data to localStorage
  const saveMasterData = (type: 'category' | 'size' | 'department', data: string[]) => {
    const key = type === 'category' ? 'clothing_categories' : type === 'size' ? 'clothing_sizes' : 'departments';
    localStorage.setItem(key, JSON.stringify(data));
    message.success('Erfolgreich gespeichert');
  };

  // Open modal for add/edit
  const openModal = (type: 'category' | 'size' | 'department', item?: string) => {
    setModalType(type);
    setEditingItem(item || null);
    form.setFieldsValue({ name: item || '' });
    setIsModalVisible(true);
  };

  // Handle save (add or edit)
  const handleSave = () => {
    form.validateFields().then((values) => {
      const name = values.name.trim();
      let data: string[];

      if (modalType === 'category') {
        data = editingItem ? categories.map(c => c === editingItem ? name : c) : [...categories, name];
        setCategories(data);
        saveMasterData('category', data);
      } else if (modalType === 'size') {
        data = editingItem ? sizes.map(s => s === editingItem ? name : s) : [...sizes, name];
        setSizes(data);
        saveMasterData('size', data);
      } else {
        data = editingItem ? departments.map(d => d === editingItem ? name : d) : [...departments, name];
        setDepartments(data);
        saveMasterData('department', data);
      }

      setIsModalVisible(false);
      form.resetFields();
      setEditingItem(null);
    });
  };

  // Handle delete
  const handleDelete = (type: 'category' | 'size' | 'department', item: string) => {
    let data: string[];

    if (type === 'category') {
      data = categories.filter(c => c !== item);
      setCategories(data);
      saveMasterData('category', data);
    } else if (type === 'size') {
      data = sizes.filter(s => s !== item);
      setSizes(data);
      saveMasterData('size', data);
    } else {
      data = departments.filter(d => d !== item);
      setDepartments(data);
      saveMasterData('department', data);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1>Einstellungen</h1>
      </div>

      <Tabs 
        defaultActiveKey="company"
        items={[
          {
            key: 'company',
            label: 'Unternehmen',
            children: (
              <Card title="Firmen-Logo" style={{ marginBottom: 24 }}>
                <Paragraph>
                  Laden Sie hier das Logo Ihres Unternehmens hoch. Dieses wird in der App und auf den PDF-Belegen angezeigt.
                </Paragraph>
                
                {logoUrl ? (
                  <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                    <Image
                      src={logoUrl}
                      alt="Firmen-Logo"
                      style={{ 
                        maxWidth: '300px', 
                        maxHeight: '150px', 
                        objectFit: 'contain',
                        border: '1px solid #f0f0f0',
                        borderRadius: '6px',
                        padding: '8px'
                      }}
                    />
                    <div style={{ marginTop: '12px' }}>
                      <Space>
                        <Upload
                          customRequest={handleLogoUpload}
                          showUploadList={false}
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          maxCount={1}
                          disabled={!isAdmin}
                        >
                          <Button 
                            icon={<UploadOutlined />} 
                            loading={logoUploadLoading}
                            disabled={!isAdmin}
                          >
                            Logo ersetzen
                          </Button>
                        </Upload>
                        <Button
                          danger
                          onClick={handleRemoveLogo}
                          icon={<DeleteOutlined />}
                          disabled={!isAdmin}
                        >
                          Logo entfernen
                        </Button>
                      </Space>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <Upload
                      customRequest={handleLogoUpload}
                      showUploadList={false}
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      maxCount={1}
                      disabled={!isAdmin}
                    >
                      <Button 
                        type="primary"
                        icon={<UploadOutlined />} 
                        loading={logoUploadLoading}
                        size="large"
                        disabled={!isAdmin}
                      >
                        Firmen-Logo hochladen
                      </Button>
                    </Upload>
                    <div style={{ marginTop: '8px', color: '#666' }}>
                      Unterstützte Formate: JPG, PNG, WEBP (max. 5MB)
                    </div>
                  </div>
                )}
                
                {!isAdmin && (
                  <Alert
                    message="Nur Administratoren können das Firmen-Logo ändern"
                    type="warning"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                )}
              </Card>
            ),
          },
          {
            key: 'masterdata',
            label: 'Stammdaten',
            children: (
              <Row gutter={16}>
            {/* Categories */}
            <Col span={8}>
              <Card
                title="Kategorien"
                extra={
                  canEdit && (
                    <Button
                      type="link"
                      icon={<PlusOutlined />}
                      onClick={() => openModal('category')}
                    >
                      Hinzufügen
                    </Button>
                  )
                }
              >
                <List
                  size="small"
                  dataSource={categories}
                  renderItem={(item) => (
                    <List.Item
                      actions={
                        canEdit
                          ? [
                              <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => openModal('category', item)}
                              />,
                              <Button
                                type="link"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleDelete('category', item)}
                              />,
                            ]
                          : []
                      }
                    >
                      {item}
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            {/* Sizes */}
            <Col span={8}>
              <Card
                title="Größen"
                extra={
                  canEdit && (
                    <Button
                      type="link"
                      icon={<PlusOutlined />}
                      onClick={() => openModal('size')}
                    >
                      Hinzufügen
                    </Button>
                  )
                }
              >
                <List
                  size="small"
                  dataSource={sizes}
                  renderItem={(item) => (
                    <List.Item
                      actions={
                        canEdit
                          ? [
                              <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => openModal('size', item)}
                              />,
                              <Button
                                type="link"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleDelete('size', item)}
                              />,
                            ]
                          : []
                      }
                    >
                      {item}
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            {/* Departments */}
            <Col span={8}>
              <Card
                title="Abteilungen"
                extra={
                  canEdit && (
                    <Button
                      type="link"
                      icon={<PlusOutlined />}
                      onClick={() => openModal('department')}
                    >
                      Hinzufügen
                    </Button>
                  )
                }
              >
                <List
                  size="small"
                  dataSource={departments}
                  renderItem={(item) => (
                    <List.Item
                      actions={
                        canEdit
                          ? [
                              <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => openModal('department', item)}
                              />,
                              <Button
                                type="link"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleDelete('department', item)}
                              />,
                            ]
                          : []
                      }
                    >
                      {item}
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>

        {/* Backup Tab */}
        <TabPane tab="Backup" key="backup">
          {!canExport && (
            <Alert
              message="Keine Berechtigung"
              description="Sie benötigen ADMIN- oder HR-Rechte, um Backups zu exportieren."
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <Alert
            message="Datenbank-Backup & Wiederherstellung"
            description="Exportieren Sie alle Daten als ZIP-Backup mit CSV-Dateien oder importieren Sie ein zuvor erstelltes Backup, um die Datenbank wiederherzustellen."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Card title="Datenbank-Statistiken" style={{ marginBottom: 24 }} loading={loading}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Statistic
                  title="Mitarbeiter"
                  value={stats?.employees || 0}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Statistic
                  title="Kleidungstypen"
                  value={stats?.clothingTypes || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Statistic
                  title="Kleidungsstücke"
                  value={stats?.clothingItems || 0}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Statistic
                  title="Transaktionen"
                  value={stats?.transactions || 0}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Statistic
                  title="Audit-Logs"
                  value={stats?.auditLogs || 0}
                  valueStyle={{ color: '#13c2c2' }}
                />
              </Col>
              <Col xs={24} sm={12} md={8} lg={4}>
                <Statistic
                  title="Gesamt"
                  value={stats?.totalRecords || 0}
                  valueStyle={{ color: '#cf1322', fontWeight: 'bold' }}
                />
              </Col>
            </Row>
          </Card>

          <Card
            title={
              <>
                <DownloadOutlined /> Daten exportieren (Backup erstellen)
              </>
            }
            style={{ marginBottom: 24 }}
          >
            <Paragraph>
              Exportieren Sie alle Daten aus der Datenbank als ZIP-Backup mit CSV-Dateien.
              Dies erstellt ein kompaktes Backup mit allen Tabellen in separaten CSV-Dateien.
            </Paragraph>
            <Space size="middle">
              <Button
                type="primary"
                icon={<DatabaseOutlined />}
                size="large"
                onClick={handleExportBackup}
                loading={exportLoading}
                disabled={!canExport}
              >
                ZIP-Backup erstellen (.zip)
              </Button>
            </Space>
          </Card>

          <Card
            title={
              <>
                <UploadOutlined /> Daten importieren (Backup wiederherstellen)
              </>
            }
          >
            <Alert
              message="Achtung!"
              description="Der Import überschreibt bestehende Daten mit denselben IDs. Stellen Sie sicher, dass Sie ein aktuelles Backup haben, bevor Sie einen Import durchführen."
              type="warning"
              icon={<WarningOutlined />}
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Paragraph>
              Importieren Sie ein zuvor erstelltes ZIP-Backup, um die Datenbank
              wiederherzustellen. Nur ZIP-Dateien (.zip) mit CSV-Inhalten werden unterstützt.
            </Paragraph>
            <Upload {...uploadProps}>
              <Button
                icon={<UploadOutlined />}
                size="large"
                loading={importLoading}
                disabled={!canImport}
                danger
              >
                ZIP-Backup importieren
              </Button>
            </Upload>
          </Card>
        </TabPane>

        {/* Entra ID Sync Tab */}
        <TabPane tab="Entra ID Sync" key="sync">
      <Card
        title="Entra ID Synchronisierung"
        style={{ marginBottom: '24px' }}
      >
        <Alert
          message="Automatische Synchronisierung"
          description="Mitarbeiter werden automatisch jede Stunde von Entra ID synchronisiert. Neue Mitarbeiter werden automatisch hinzugefügt und Austritte werden vermerkt."
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />

        {/* Sync Status */}
        <Spin spinning={loading}>
          {syncStatus && (
            <>
              <Row gutter={16} style={{ marginBottom: '24px' }}>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="Gesamt Mitarbeiter"
                      value={syncStatus.totalEmployees}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="Aktiv"
                      value={syncStatus.activeEmployees}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="Inaktiv"
                      value={syncStatus.inactiveEmployees}
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        Letzter Sync
                      </div>
                      <div style={{ fontSize: '14px', marginTop: '8px' }}>
                        <Tag color="blue">
                          {new Date(syncStatus.lastSync).toLocaleString('de-DE')}
                        </Tag>
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Divider />

              {/* Sync Controls */}
              {isAdmin ? (
                <div>
                  <p style={{ marginBottom: '16px' }}>
                    <strong>Manueller Sync:</strong> Klicken Sie auf den Button
                    unten, um Mitarbeiter jetzt von Entra ID zu synchronisieren.
                  </p>
                  <Space>
                    <Button
                      type="primary"
                      icon={<SyncOutlined />}
                      onClick={handleManualSync}
                      loading={syncing}
                      disabled={syncing}
                    >
                      {syncing ? 'Synchronisiert...' : 'Jetzt synchronisieren'}
                    </Button>
                    <Button
                      onClick={fetchSyncStatus}
                      loading={loading}
                      disabled={syncing || loading}
                    >
                      Status aktualisieren
                    </Button>
                  </Space>
                </div>
              ) : (
                <Alert
                  message="Nur Administratoren können die Synchronisierung manuell starten"
                  type="warning"
                  showIcon
                />
              )}
            </>
          )}
        </Spin>
      </Card>

        </TabPane>

        {/* System Info Tab */}
        <TabPane tab="Systeminfo" key="system">
          <Card title="Systeminfo">
            <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <p>
                <strong>App Version:</strong> 1.0.0
              </p>
              <p>
                <strong>Umgebung:</strong> Production
              </p>
              <p>
                <strong>Datenbank:</strong> SQLite
              </p>
              <p>
                <strong>API Version:</strong> 1.0
              </p>
            </div>
          </Card>
        </TabPane>
      </Tabs>

      {/* Import Result Modal */}
      <Modal
        title="Import-Ergebnis"
        open={showImportModal}
        onOk={() => setShowImportModal(false)}
        onCancel={() => setShowImportModal(false)}
        width={700}
        footer={[
          <Button key="close" type="primary" onClick={() => setShowImportModal(false)}>
            Schließen
          </Button>,
        ]}
      >
        {importResult && (
          <>
            <Alert
              message={
                importResult.success
                  ? 'Import erfolgreich abgeschlossen'
                  : 'Import mit Fehlern abgeschlossen'
              }
              type={importResult.success ? 'success' : 'warning'}
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Table
              columns={importColumns}
              dataSource={getImportTableData()}
              pagination={false}
              size="small"
              style={{ marginBottom: 16 }}
            />

            {importResult.errors && importResult.errors.length > 0 && (
              <>
                <Title level={5}>Fehler ({importResult.errors.length}):</Title>
                <div
                  style={{
                    maxHeight: '200px',
                    overflow: 'auto',
                    background: '#fff2e8',
                    padding: '12px',
                    borderRadius: '4px',
                  }}
                >
                  {importResult.errors.map((error, index) => (
                    <div key={index} style={{ marginBottom: 4 }}>
                      <Text type="danger">• {error}</Text>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Modal>

      {/* Modal for Add/Edit */}
      <Modal
        title={`${editingItem ? 'Bearbeiten' : 'Hinzufügen'} - ${
          modalType === 'category' ? 'Kategorie' : modalType === 'size' ? 'Größe' : 'Abteilung'
        }`}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
          setEditingItem(null);
        }}
        okText="Speichern"
        cancelText="Abbrechen"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Bitte einen Namen eingeben' }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
