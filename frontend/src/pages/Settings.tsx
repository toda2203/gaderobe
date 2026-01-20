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
  Switch,
  Collapse,
} from 'antd';
import { MasterDataList } from '@components/Settings/MasterDataList';
import { AutomaticBackupConfig } from '@components/Settings/AutomaticBackupConfig';
import type { UploadProps, TabsProps } from 'antd';
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
  FileImageOutlined,
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
  imageValidation?: {
    found: number;
    missing: number;
    orphaned: number;
  };
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
  const [validatingImages, setValidatingImages] = useState(false);
  const [imageValidation, setImageValidation] = useState<any>(null);
  const [showImageModal, setShowImageModal] = useState(false);
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

  // Email mode states
  const [emailMode, setEmailMode] = useState<'production' | 'development'>('production');
  const [testAddress, setTestAddress] = useState<string>('d.troks+clothing@autohaus-graupner.de');
  const [emailModeLoading, setEmailModeLoading] = useState(false);

  useEffect(() => {
    fetchSyncStatus();
    loadMasterData();
    loadLogo();
    if (user) {
      fetchStats();
      loadEmailMode();
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
      formData.append('logo', file);

      const response = await api.post('/clothing/upload-company-logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const imageUrl = response.data.data.imageUrl;
      setLogoUrl(imageUrl);
      localStorage.setItem('company_logo', imageUrl);
      message.success('Firmenlogo erfolgreich hochgeladen');
      
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

  // Load email mode configuration
  const loadEmailMode = async () => {
    try {
      const response = await api.get('/system/email-config');
      const { mode, testAddress: configTestAddress } = response.data.data;
      setEmailMode(mode);
      if (configTestAddress) {
        setTestAddress(configTestAddress);
      }
    } catch (error) {
      console.error('Error loading email mode:', error);
    }
  };

  // Update email mode
  const handleEmailModeChange = async (newMode: 'production' | 'development') => {
    setEmailModeLoading(true);
    try {
      const response = await api.post('/system/email-config', {
        mode: newMode,
        testAddress,
      });
      setEmailMode(newMode);
      message.success(response.data.message);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Fehler beim Speichern der Email-Konfiguration';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Speichern der Email-Konfiguration');
      // Reset to previous mode
      loadEmailMode();
    } finally {
      setEmailModeLoading(false);
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
        imageValidation: response.data?.imageValidation,
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

  const handleValidateImages = async () => {
    setValidatingImages(true);
    try {
      const response = await apiClient.get('/export/validate-images');
      setImageValidation(response.data.data);
      setShowImageModal(true);
      
      const { found, missing, orphaned } = response.data.data.summary;
      if (missing === 0 && orphaned === 0) {
        message.success(`✅ Alle Bilder OK! ${found} Bilder gefunden.`);
      } else {
        message.warning(`⚠️ ${missing} Bilder fehlen, ${orphaned} Waisendateien gefunden.`);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Fehler beim Validieren';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Validieren');
      console.error('Image validation error:', error);
    } finally {
      setValidatingImages(false);
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
      render: (count: number) => <Text strong>{count}</Text>,
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

  const items: TabsProps['items'] = [
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
          <Col xs={24} sm={24} md={8}>
            <MasterDataList title="Kategorien" type="CATEGORY" canEdit={canEdit} />
          </Col>
          <Col xs={24} sm={24} md={8}>
            <MasterDataList title="Größen" type="SIZE" canEdit={canEdit} />
          </Col>
          <Col xs={24} sm={24} md={8}>
            <MasterDataList title="Abteilungen" type="DEPARTMENT" canEdit={canEdit} />
          </Col>
        </Row>
      ),
    },
    {
      key: 'backup',
      label: 'Backup',
      children: (
        <>
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
            message="Vollständiges Datenbank-Backup mit Dateien"
            description="Exportieren Sie alle Daten, Bilder und Protokolle als ZIP-Backup oder importieren Sie ein zuvor erstelltes Backup, um alle Inhalte wiederherzustellen."
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
              Exportieren Sie alle Daten aus der Datenbank als ZIP-Backup mit:
            </Paragraph>
            <ul>
              <li>CSV-Dateien (alle Tabellen)</li>
              <li>Hochgeladene Bilder (Kleidung, Firmenlogo)</li>
              <li>Generierte Protokoll-PDFs</li>
            </ul>
            <Paragraph type="secondary" style={{ marginTop: 12 }}>
              Dies erstellt ein komplettes, portables Backup aller Daten und Dateien.
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
                Komplettes Backup erstellen (.zip)
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
              description="Der Import überschreibt bestehende Daten mit denselben IDs und stellt alle Bilder und Protokolle wieder her. Stellen Sie sicher, dass Sie ein aktuelles Backup haben, bevor Sie einen Import durchführen."
              type="warning"
              icon={<WarningOutlined />}
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Paragraph>
              Importieren Sie ein zuvor erstelltes Komplettes ZIP-Backup, um die gesamte Datenbank
              mit allen Bildern und Protokollen wiederherzustellen. Nur ZIP-Dateien (.zip) werden unterstützt.
            </Paragraph>
            <Space size="middle" direction="vertical" style={{ width: '100%' }}>
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
              <Button 
                icon={<FileImageOutlined />}
                onClick={handleValidateImages}
                loading={validatingImages}
                disabled={!canImport}
              >
                Bilder validieren
              </Button>
            </Space>
          </Card>

          {/* Automatische Backups */}
          <AutomaticBackupConfig />
        </>
      ),
    },
    {
      key: 'sync',
      label: 'Entra ID Sync',
      children: (
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
      ),
    },
    {
      key: 'system',
      label: 'Systeminfo',
      children: (
        <div>
          <Card title="Email-Konfiguration" style={{ marginBottom: 24 }}>
            {isAdmin && (
              <div>
                <Collapse
                  items={[
                    {
                      key: 'email-mode',
                      label: 'Email-Modus',
                      children: (
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <Text strong>Produktionsmodus:</Text>
                            <Switch
                              checked={emailMode === 'production'}
                              loading={emailModeLoading}
                              onChange={(checked) => handleEmailModeChange(checked ? 'production' : 'development')}
                              checkedChildren="Aktiv"
                              unCheckedChildren="Inaktiv"
                            />
                          </div>
                          
                          {emailMode === 'production' ? (
                            <Alert
                              type="success"
                              message="Produktionsmodus aktiv"
                              description="Emails werden an die tatsächlichen Mitarbeiter-Adressen gesendet."
                              showIcon
                            />
                          ) : (
                            <Alert
                              type="warning"
                              message="Entwicklungsmodus aktiv"
                              description={
                                <div>
                                  <div>Alle Emails werden an die Test-Adresse umgeleitet:</div>
                                  <Text strong>{testAddress}</Text>
                                  <div style={{ marginTop: 8 }}>
                                    <Input
                                      value={testAddress}
                                      onChange={(e) => setTestAddress(e.target.value)}
                                      placeholder="test@beispiel.de"
                                      style={{ width: 350 }}
                                      onBlur={() => {
                                        if (testAddress && emailMode === 'development') {
                                          handleEmailModeChange('development');
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              }
                              showIcon
                            />
                          )}
                        </Space>
                      ),
                    },
                  ]}
                  style={{ marginBottom: 24 }}
                />

                <Divider orientation="left">Email-Test</Divider>
                <Paragraph>
                  Testen Sie die Email-Konfiguration des Systems. Eine Test-Email wird an die angegebene Adresse gesendet.
                </Paragraph>
                <Form
                  layout="inline"
                  onFinish={async (values) => {
                    try {
                      const response = await api.post('/system/test-email', {
                        testEmail: values.testEmail,
                      });
                      message.success(response.data.message);
                    } catch (error: any) {
                      const errorMsg = error.response?.data?.error || error.message || 'Fehler beim Senden der Test-Email';
                      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Senden der Test-Email');
                    }
                  }}
                  style={{ marginBottom: 16 }}
                >
                  <Form.Item
                    name="testEmail"
                    rules={[
                      { required: true, message: 'Email-Adresse eingeben' },
                      { type: 'email', message: 'Gültige Email-Adresse eingeben' },
                    ]}
                  >
                    <Input placeholder="test@beispiel.de" style={{ width: 250 }} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      Test-Email senden
                    </Button>
                  </Form.Item>
                </Form>
                
                <Button
                  onClick={async () => {
                    try {
                      const response = await api.get('/system/email-config');
                      const config = response.data.data;
                      message.info(`SMTP: ${config.smtpHost}:${config.smtpPort}, User: ${config.smtpUser}, Passwort: ${config.hasPassword ? 'Konfiguriert' : 'Nicht konfiguriert'}`);
                    } catch (error: any) {
                      const errorMsg = error.response?.data?.error || error.message || 'Fehler beim Laden der Email-Konfiguration';
                      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Laden der Email-Konfiguration');
                    }
                  }}
                >
                  Email-Konfiguration anzeigen
                </Button>
              </div>
            )}
            
            {!isAdmin && (
              <Alert
                message="Nur Administratoren können Email-Tests durchführen"
                type="warning"
                showIcon
              />
            )}
          </Card>
          
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
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1>Einstellungen</h1>
      </div>

      <Tabs defaultActiveKey="company" items={items} />

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

            {importResult.imageValidation && (
              <div style={{ marginTop: 16 }}>
                <Divider />
                <Title level={5}>Bildvalidierung</Title>
                <div style={{ 
                  background: '#f0f5ff', 
                  padding: '12px', 
                  borderRadius: '4px',
                  marginBottom: 12
                }}>
                  <p><strong>✅ Gefunden:</strong> {importResult.imageValidation.found} Bilder</p>
                  {importResult.imageValidation.missing > 0 && (
                    <p><strong style={{ color: '#ff4d4f' }}>❌ Fehlen:</strong> {importResult.imageValidation.missing} Bilder</p>
                  )}
                  {importResult.imageValidation.orphaned > 0 && (
                    <p><strong style={{ color: '#faad14' }}>🗑️ Waisen:</strong> {importResult.imageValidation.orphaned} Dateien</p>
                  )}
                </div>
                <Button 
                  type="primary" 
                  icon={<FileImageOutlined />}
                  onClick={handleValidateImages}
                  loading={validatingImages}
                >
                  Detaillierte Bildvalidierung
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Image Validation Modal */}
      <Modal
        title="Bildvalidierungs-Bericht"
        open={showImageModal}
        onOk={() => setShowImageModal(false)}
        onCancel={() => setShowImageModal(false)}
        width={800}
        footer={[
          <Button key="close" type="primary" onClick={() => setShowImageModal(false)}>
            Schließen
          </Button>,
        ]}
      >
        {imageValidation && (
          <>
            <Alert
              message="Bildvalidierungs-Status"
              type={imageValidation.summary.missing === 0 && imageValidation.summary.orphaned === 0 ? 'success' : 'warning'}
              showIcon
              style={{ marginBottom: 16 }}
              description={
                <div>
                  <p>✅ Gefunden: {imageValidation.summary.found}/{imageValidation.summary.total}</p>
                  {imageValidation.summary.missing > 0 && (
                    <p style={{ color: '#ff4d4f' }}>❌ Fehlen: {imageValidation.summary.missing}</p>
                  )}
                  {imageValidation.summary.orphaned > 0 && (
                    <p style={{ color: '#faad14' }}>🗑️ Waisen: {imageValidation.summary.orphaned}</p>
                  )}
                </div>
              }
            />

            {imageValidation.found && imageValidation.found.length > 0 && (
              <>
                <Title level={5}>✅ Gefundene Bilder ({imageValidation.found.length})</Title>
                <div style={{ 
                  maxHeight: '200px', 
                  overflow: 'auto', 
                  background: '#f6ffed', 
                  padding: '12px', 
                  borderRadius: '4px',
                  marginBottom: 16
                }}>
                  {imageValidation.found.map((img: any, idx: number) => (
                    <div key={idx} style={{ fontSize: '12px', marginBottom: 4 }}>
                      <Tag color="green">{img.type}</Tag> {img.name}
                    </div>
                  ))}
                </div>
              </>
            )}

            {imageValidation.missing && imageValidation.missing.length > 0 && (
              <>
                <Title level={5}>❌ Fehlende Bilder ({imageValidation.missing.length})</Title>
                <div style={{ 
                  maxHeight: '200px', 
                  overflow: 'auto', 
                  background: '#fff1f0', 
                  padding: '12px', 
                  borderRadius: '4px',
                  marginBottom: 16
                }}>
                  {imageValidation.missing.map((img: any, idx: number) => (
                    <div key={idx} style={{ fontSize: '12px', marginBottom: 4 }}>
                      <Tag color="red">{img.type}</Tag> {img.name}
                      <br />
                      <Text type="secondary">Erwartet: {img.suggestedPath}</Text>
                    </div>
                  ))}
                </div>
              </>
            )}

            {imageValidation.orphaned && imageValidation.orphaned.length > 0 && (
              <>
                <Title level={5}>🗑️ Waisendateien ({imageValidation.orphaned.length})</Title>
                <div style={{ 
                  maxHeight: '200px', 
                  overflow: 'auto', 
                  background: '#fffbe6', 
                  padding: '12px', 
                  borderRadius: '4px',
                  marginBottom: 16
                }}>
                  {imageValidation.orphaned.map((file: string, idx: number) => (
                    <div key={idx} style={{ fontSize: '12px', marginBottom: 4 }}>
                      📁 {file}
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
