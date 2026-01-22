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
  App,
  InputNumber,
  DatePicker,
  Upload,
  Image,
  message as antdMessage,
  Descriptions,
  Tabs,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  QrcodeOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { QRCodeCanvas } from 'qrcode.react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import dayjs from 'dayjs';

const { TextArea } = Input;

// Condition options constant - used everywhere for consistency
const CONDITION_OPTIONS = [
  { label: 'Neu', value: 'NEW' },
  { label: 'Gut', value: 'GOOD' },
  { label: 'Abgenutzt', value: 'WORN' },
  { label: 'Ausgemustert', value: 'RETIRED' },
];

interface ClothingType {
  id: string;
  name: string;
  category: string;
  availableSizes: string[];
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ClothingItem {
  id: string;
  internalId: string;
  qrCode: string;
  type: ClothingType;
  typeId: string;
  size: string;
  category: 'PERSONALIZED' | 'POOL';
  condition: 'NEW' | 'GOOD' | 'WORN' | 'RETIRED';
  status: 'AVAILABLE' | 'ISSUED' | 'IN_USE' | 'RETURNED' | 'RETIRED' | 'LOST';
  isPersonalized: boolean;
  personalizedFor: Employee | null;
  currentEmployee: Employee | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  imageUrl: string | null;
  createdAt: string;
}

interface ClothingItemStats {
  total: number;
  available: number;
  issued: number;
  retired: number;
  byCategory: Array<{ category: string; count: number }>;
  byCondition: Array<{ condition: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}

const ClothingItemsPage: React.FC = () => {
  const { message } = App.useApp();
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ClothingItem[]>([]);
  const [clothingTypes, setClothingTypes] = useState<ClothingType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<ClothingItemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBulkModalVisible, setIsBulkModalVisible] = useState(false);
  const [bulkForm] = Form.useForm();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [editSelectedTypeId, setEditSelectedTypeId] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [editUploadedImageUrl, setEditUploadedImageUrl] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [editUploadLoading, setEditUploadLoading] = useState(false);
  
  // Enhanced Detail Modal State
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [itemHistory, setItemHistory] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Search and filter
  const [searchText, setSearchText] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterCondition, setFilterCondition] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  
  const { user } = useAuthStore();
  const canEdit = Boolean(user && user.role !== 'READ_ONLY');
  const isAdmin = user?.role === 'ADMIN';

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Check if URL has id parameter (from QR code scan or navigation)
      const urlParams = new URLSearchParams(window.location.search);
      const itemId = urlParams.get('id') || urlParams.get('itemId');
      console.log('URL parameter itemId:', itemId);
      
      const [itemsRes, statsRes, typesRes, employeesRes] = await Promise.all([
        api.get('/clothing/items'),
        api.get('/clothing/items/stats'),
        api.get('/clothing-types', { params: { isActive: true } }),
        api.get('/employees', { params: { status: 'ACTIVE' } }),
      ]);

      const items = itemsRes.data.data;
      console.log('Loaded items count:', items.length);
      
      setClothingItems(items);
      setStats(statsRes.data.data);
      setClothingTypes(typesRes.data.data);
      setEmployees(employeesRes.data.data);

      // Show item details if id parameter exists
      if (itemId) {
        const item = items.find((i: ClothingItem) => i.id === itemId);
        console.log('Found item:', item ? item.internalId : 'NOT FOUND');
        
        if (item) {
          // Delay to ensure component is fully rendered
          setTimeout(() => {
            console.log('Opening modal for item:', item.internalId);
            showItemDetails(item);
            // Clear URL parameter after showing details
            window.history.replaceState({}, '', '/clothing-items');
          }, 500);
        } else {
          message.warning('Kleidungsstück nicht gefunden');
          window.history.replaceState({}, '', '/clothing-items');
        }
      }
    } catch (error) {
      message.error('Fehler beim Laden der Kleidungsstücke');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters whenever search or filter values change
  useEffect(() => {
    let filtered = clothingItems;

    // Search filter (internalId, qrCode, type name)
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.internalId.toLowerCase().includes(search) ||
          item.qrCode?.toLowerCase().includes(search) ||
          item.type.name.toLowerCase().includes(search) ||
          item.size.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (filterStatus.length > 0) {
      filtered = filtered.filter((item) => filterStatus.includes(item.status));
    }

    // Condition filter
    if (filterCondition.length > 0) {
      filtered = filtered.filter((item) => filterCondition.includes(item.condition));
    }

    // Category filter
    if (filterCategory) {
      filtered = filtered.filter((item) => item.category === filterCategory);
    }

    // Type filter
    if (filterType) {
      filtered = filtered.filter((item) => item.typeId === filterType);
    }

    setFilteredItems(filtered);
  }, [clothingItems, searchText, filterStatus, filterCondition, filterCategory, filterType]);

  const showItemDetails = async (item: ClothingItem) => {
    setSelectedItem(item);
    setDetailModalVisible(true);
    setDetailLoading(true);
    
    try {
      const historyResponse = await api.get(`/transactions/history/${item.id}`);
      
      if (historyResponse.data.success) {
        setItemHistory(historyResponse.data.data);
      }

      // Try to load audit logs, but don't fail if not available
      try {
        console.log('Attempting to load audit logs for item:', item.id);
        const auditResponse = await api.get(`/clothing/items/${item.id}/audit-log`);
        console.log('Audit response:', auditResponse.data);
        if (auditResponse.data.success) {
          setAuditLogs(auditResponse.data.data);
          console.log('Loaded audit logs:', auditResponse.data.data.length, 'entries');
        } else {
          console.warn('Audit response not successful:', auditResponse.data);
          setAuditLogs([]);
        }
      } catch (auditError) {
        console.warn('Audit logs not available:', (auditError as any)?.response?.status, (auditError as any)?.response?.data);
        setAuditLogs([]); // Set empty array if audit logs fail
      }
      
      if ((item.status === 'ISSUED') && !item.currentEmployee) {
        console.log('Detected inconsistency, refreshing item data...');
        try {
          const itemResponse = await api.get(`/clothing/items`);
          if (itemResponse.data.success) {
            const refreshedItems = itemResponse.data.data;
            const refreshedItem = refreshedItems.find((i: ClothingItem) => i.id === item.id);
            if (refreshedItem && refreshedItem.currentEmployee) {
              setSelectedItem(refreshedItem);
              console.log('Item data refreshed successfully');
            }
          }
        } catch (refreshError) {
          console.error('Error refreshing item data:', refreshError);
        }
      }
    } catch (error) {
      console.error('Error fetching item details:', error);
      antdMessage.error('Fehler beim Laden der Artikel-Details');
      setItemHistory([]);
      setAuditLogs([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const showQRCodeModal = (item: ClothingItem) => {
    const itemUrl = `${window.location.origin}/clothing?id=${item.id}`;
    
    Modal.info({
      title: 'QR-Code',
      width: 450,
      content: (
        <div style={{ textAlign: 'center' }}>
          <p>
            <strong>Interne ID:</strong> {item.internalId}
          </p>
          <p>
            <strong>{item.type.name}</strong> - Größe {item.size}
          </p>
          <div style={{ margin: '20px 0' }}>
            <QRCodeCanvas
              value={itemUrl}
              size={300}
              level="H"
              includeMargin={true}
            />
          </div>
          <p style={{ fontSize: '11px', color: '#999', wordBreak: 'break-all' }}>
            Scannt zu: {itemUrl}
          </p>
        </div>
      ),
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      AVAILABLE: 'green',
      PENDING: 'gold',
      ISSUED: 'orange',
      IN_USE: 'blue',
      RETURNED: 'cyan',
      RETIRED: 'red',
      LOST: 'volcano',
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      AVAILABLE: 'Verfügbar',
      PENDING: 'Ausstehend',
      ISSUED: 'Ausgegeben',
      IN_USE: 'In Nutzung',
      RETURNED: 'Zurückgegeben',
      RETIRED: 'Ausgemustert',
      LOST: 'Verloren',
    };
    return labels[status] || status;
  };

  const getConditionColor = (condition: string) => {
    const colors: Record<string, string> = {
      NEW: 'green',
      GOOD: 'blue',
      WORN: 'orange',
      RETIRED: 'red',
      ACCEPTABLE: 'orange', // Legacy value mapping
      DAMAGED: 'red', // Legacy value mapping
    };
    return colors[condition] || 'default';
  };

  const getConditionLabel = (condition: string) => {
    const labels: Record<string, string> = {
      NEW: 'Neu',
      GOOD: 'Gut',
      WORN: 'Abgenutzt',
      RETIRED: 'Ausgemustert',
      ACCEPTABLE: 'Abgenutzt', // Legacy value mapping to WORN
      DAMAGED: 'Ausgemustert', // Legacy value mapping to RETIRED
    };
    return labels[condition] || condition;
  };

  // Handle image upload
  const handleImageUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    setUploadLoading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/clothing/items/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const imageUrl = response.data.data.imageUrl;
      console.log('Uploaded image URL:', imageUrl);
      setUploadedImageUrl(imageUrl);
      bulkForm.setFieldsValue({ imageUrl });
      
      // Force re-render to show image
      setTimeout(() => {
        message.success('Bild erfolgreich hochgeladen');
      }, 100);
      
      if (onSuccess) onSuccess(response.data);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Fehler beim Hochladen');
      if (onError) onError(error);
    } finally {
      setUploadLoading(false);
    }
  };

  // Handle image upload for edit modal
  const handleEditImageUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    setEditUploadLoading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/clothing/items/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const imageUrl = response.data.data.imageUrl;
      setEditUploadedImageUrl(imageUrl);
      editForm.setFieldsValue({ imageUrl });
      
      setTimeout(() => {
        message.success('Bild erfolgreich hochgeladen');
      }, 100);
      
      if (onSuccess) onSuccess(response.data);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Fehler beim Hochladen');
      if (onError) onError(error);
    } finally {
      setEditUploadLoading(false);
    }
  };

  // Handle remove uploaded image
  const handleRemoveImage = async () => {
    const currentImageUrl = bulkForm.getFieldValue('imageUrl') || uploadedImageUrl;
    
    if (currentImageUrl) {
      try {
        await api.delete('/clothing/items/delete-image', {
          data: { imageUrl: currentImageUrl },
        });
        setUploadedImageUrl(null);
        bulkForm.setFieldsValue({ imageUrl: null });
        message.success('Bild entfernt');
      } catch (error) {
        console.error('Error removing image:', error);
      }
    } else {
      setUploadedImageUrl(null);
      bulkForm.setFieldsValue({ imageUrl: null });
    }
  };

  // Handle remove uploaded image for edit modal
  const handleEditRemoveImage = async () => {
    const currentImageUrl = editForm.getFieldValue('imageUrl') || editUploadedImageUrl;
    
    if (currentImageUrl) {
      try {
        await api.delete('/clothing/items/delete-image', {
          data: { imageUrl: currentImageUrl },
        });
        setEditUploadedImageUrl(null);
        editForm.setFieldsValue({ imageUrl: null });
        message.success('Bild entfernt');
      } catch (error) {
        console.error('Error removing image:', error);
      }
    } else {
      setEditUploadedImageUrl(null);
      editForm.setFieldsValue({ imageUrl: null });
    }
  };

  // Handle bulk create (only for new items)
  const handleBulkCreate = async (values: any) => {
    try {
      console.log('Bulk create values:', values); // Debug logging
      
      const payload = {
        ...values,
        purchaseDate: values.purchaseDate ? values.purchaseDate.toISOString() : undefined,
      };

      console.log('Bulk create payload:', payload); // Debug logging

      const response = await api.post('/clothing/items/bulk', payload);
      message.success(response.data.message || `${values.quantity} Artikel erstellt`);

      setIsBulkModalVisible(false);
      bulkForm.resetFields();
      setSelectedTypeId(null);
      setUploadedImageUrl(null);
      fetchData();
    } catch (error: any) {
      console.error('Bulk create error:', error); // Debug logging
      message.error(error.response?.data?.error || 'Fehler beim Erstellen');
    }
  };

  // Handle edit - open separate edit modal
  const handleEdit = (item: ClothingItem) => {
    setEditingItem(item);
    editForm.setFieldsValue({
      typeId: item.typeId,
      size: item.size,
      category: item.category,
      condition: item.condition,
      status: item.status,
      purchaseDate: item.purchaseDate ? dayjs(item.purchaseDate) : null,
      purchasePrice: item.purchasePrice,
      imageUrl: item.imageUrl,
    });
    setEditUploadedImageUrl(item.imageUrl);
    setEditSelectedTypeId(item.typeId);
    setIsEditModalVisible(true);
  };

  // Handle edit submit
  const handleEditSubmit = async (values: any) => {
    if (!editingItem) return;

    try {
      const payload = {
        typeId: values.typeId,
        size: values.size,
        category: values.category,
        condition: values.condition,
        status: values.status,
        purchaseDate: values.purchaseDate ? values.purchaseDate.toISOString() : null,
        purchasePrice: values.purchasePrice,
        imageUrl: values.imageUrl,
      };

      await api.patch(`/clothing/items/${editingItem.id}`, payload);
      message.success('Kleidungsstück erfolgreich aktualisiert');

      setIsEditModalVisible(false);
      editForm.resetFields();
      setEditingItem(null);
      setEditSelectedTypeId(null);
      setEditUploadedImageUrl(null);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Fehler beim Aktualisieren');
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/clothing/items/${id}`);
      message.success('Kleidungsstück ausgemustert');
      fetchData();
    } catch (error) {
      message.error('Fehler beim Löschen des Kleidungsstücks');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      await api.delete(`/clothing/items/${id}/permanent`);
      message.success('Kleidungsstück dauerhaft gelöscht');
      fetchData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Fehler beim dauerhaften Löschen';
      message.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }
  };

  // Handle type change to update available sizes
  const handleTypeChange = (typeId: string) => {
    setSelectedTypeId(typeId);
    bulkForm.setFieldValue('size', undefined);
  };

  const selectedType = clothingTypes.find((t) => t.id === selectedTypeId);

  const columns = [
    {
      title: 'Bild',
      key: 'image',
      width: 80,
      render: (_: any, record: ClothingItem) => {
        // Verwende das eigene Bild oder falle zurück auf das Typ-Bild
        const imageUrl = record.imageUrl || (record.type as any)?.imageUrl;
        
        return imageUrl ? (
          <Image
            src={imageUrl}
            alt={record.type.name}
            width={50}
            height={50}
            style={{ objectFit: 'cover', borderRadius: '4px' }}
            preview={true}
          />
        ) : (
          <div
            style={{
              width: 50,
              height: 50,
              background: '#f0f0f0',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#999',
            }}
          >
            -
          </div>
        );
      },
    },
    {
      title: 'Interne ID',
      dataIndex: 'internalId',
      key: 'internalId',
      width: 150,
      sorter: (a: ClothingItem, b: ClothingItem) =>
        a.internalId.localeCompare(b.internalId),
    },
    {
      title: 'Typ',
      key: 'type',
      render: (_: any, record: ClothingItem) => record.type.name,
    },
    {
      title: 'Größe',
      dataIndex: 'size',
      key: 'size',
      width: 80,
    },
    {
      title: 'Kategorie',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => (
        <Tag color={category === 'PERSONALIZED' ? 'purple' : 'blue'}>
          {category === 'PERSONALIZED' ? 'Personalisiert' : 'Pool'}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: 'Zustand',
      dataIndex: 'condition',
      key: 'condition',
      render: (condition: string) => (
        <Tag color={getConditionColor(condition)}>{getConditionLabel(condition)}</Tag>
      ),
    },
    {
      title: 'Aktueller Mitarbeiter',
      key: 'currentEmployee',
      render: (_: any, record: ClothingItem) =>
        record.currentEmployee
          ? `${record.currentEmployee.firstName} ${record.currentEmployee.lastName}`
          : '-',
    },
    {
      title: 'Aktion',
      key: 'action',
      fixed: 'right' as const,
      width: 200,
      render: (_: any, record: ClothingItem) => (
        <Space size="small">
          <Button
            size="small"
            icon={<QrcodeOutlined />}
            onClick={() => showQRCodeModal(record)}
          />
          {canEdit && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
              <Popconfirm
                title="Kleidungsstück ausmustern?"
                description="Sind Sie sicher?"
                onConfirm={() => handleDelete(record.id)}
                okText="Ja"
                cancelText="Nein"
              >
                <Button 
                  danger 
                  size="small" 
                  icon={<DeleteOutlined />} 
                  title="Kleidungsstück ausmustern"
                />
              </Popconfirm>
              {isAdmin && record.status === 'RETIRED' && (
                <Popconfirm
                  title="Dauerhaft löschen?"
                  description="Diese Aktion kann nicht rückgängig gemacht werden!"
                  onConfirm={() => handlePermanentDelete(record.id)}
                  okText="Ja, löschen"
                  cancelText="Abbrechen"
                  okButtonProps={{ danger: true }}
                >
                  <Button 
                    danger
                    type="primary"
                    size="small" 
                    icon={<DeleteOutlined />} 
                    title="Dauerhaft löschen"
                  />
                </Popconfirm>
              )}
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
      
      antdMessage.success(`${type === 'issue' ? 'Ausgabe' : 'Rücknahme'}protokoll heruntergeladen`);
    } catch (error: any) {
      console.error('Error downloading protocol:', error);
      
      if (error.response?.status === 403) {
        antdMessage.error('Ausgabeprotokoll kann erst nach bestätigtem Erhalt durch den Mitarbeiter erstellt werden');
      } else if (error.response?.status === 404) {
        antdMessage.error('Transaktion nicht gefunden');
      } else {
        antdMessage.error('Fehler beim Herunterladen des Protokolls');
      }
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1>Kleidungsstücke</h1>
      </div>

      <Card size="small" style={{ marginBottom: '16px', background: '#fafafa', borderColor: '#e5e7eb' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 500, color: '#1f2937' }}>
          Schritt 2: Kleidungsartikel erzeugen und verwalten
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
          Hier werden konkrete Kleidungsstücke auf Basis der Kleidungstypen angelegt – z. B. „Arbeitshandschuhe, Größe M, neu, lagernd". 
          Jeder Artikel bekommt eine interne ID, QR-Code, Zustand (neu/gut/abgenutzt/beschädigt) und Kategorie (personalisiert oder Pool). 
          Sie können Artikel einzeln erstellen oder in Menge (Bulk) hinzufügen. Der Verlauf zeigt alle Aus- und Rückgaben sowie Zustandsänderungen.
        </p>
      </Card>

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
                title="Verfügbar"
                value={stats.available}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Ausgegeben"
                value={stats.issued}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Ausgemustert"
                value={stats.retired}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Toolbar */}
      <div style={{ marginBottom: '16px' }}>
        <Space wrap>
          {canEdit && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                bulkForm.resetFields();
                setEditingId(null);
                setSelectedTypeId(null);
                setUploadedImageUrl(null);
                setIsBulkModalVisible(true);
              }}
            >
              Kleidungsstück anlegen
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Aktualisieren
          </Button>
        </Space>
      </div>

      {/* Search and Filter */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Input.Search
              placeholder="Suche (ID, QR, Typ, Größe)"
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
              maxTagCount={2}
              maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
              options={[
                { label: 'Verfügbar', value: 'AVAILABLE' },
                { label: 'Ausgegeben', value: 'ISSUED' },
                { label: 'In Nutzung', value: 'IN_USE' },
                { label: 'Zurückgegeben', value: 'RETURNED' },
                { label: 'Ausgemustert', value: 'RETIRED' },
                { label: 'Verloren', value: 'LOST' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              mode="multiple"
              placeholder="Nach Zustand filtern"
              value={filterCondition}
              onChange={(value) => setFilterCondition(value || [])}
              allowClear
              style={{ width: '100%' }}
              maxTagCount={2}
              maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
              options={CONDITION_OPTIONS}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Nach Kategorie filtern"
              value={filterCategory || undefined}
              onChange={(value) => setFilterCategory(value)}
              allowClear
              options={[
                { label: 'Personalisiert', value: 'PERSONALIZED' },
                { label: 'Pool', value: 'POOL' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Nach Typ filtern"
              value={filterType || undefined}
              onChange={(value) => setFilterType(value)}
              allowClear
              options={clothingTypes.map((type) => ({
                label: type.name,
                value: type.id,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button
              onClick={() => {
                setSearchText('');
                setFilterStatus([]);
                setFilterCondition([]);
                setFilterCategory('');
                setFilterType('');
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
          dataSource={filteredItems}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1400 }}
          onRow={(record) => ({
            onDoubleClick: () => showItemDetails(record),
          })}
        />
      </Spin>

      {/* Create Modal */}
      <Modal
        title="Kleidungsstück anlegen"
        open={isBulkModalVisible}
        onCancel={() => {
          setIsBulkModalVisible(false);
          bulkForm.resetFields();
          setSelectedTypeId(null);
          setUploadedImageUrl(null);
        }}
        footer={null}
        width={700}
      >
        <Form form={bulkForm} layout="vertical" onFinish={handleBulkCreate}>
          {/* Image Upload Section */}
          <Form.Item label="Bild" name="imageUrl">
            <div>
              {uploadedImageUrl || bulkForm.getFieldValue('imageUrl') ? (
                <div style={{ marginBottom: '16px' }}>
                  <Image
                    src={uploadedImageUrl || bulkForm.getFieldValue('imageUrl')}
                    alt="Kleidungsstück"
                    style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }}
                  />
                  <div style={{ marginTop: '8px' }}>
                    <Button
                      danger
                      size="small"
                      onClick={handleRemoveImage}
                      icon={<DeleteOutlined />}
                    >
                      Bild entfernen
                    </Button>
                  </div>
                </div>
              ) : (
                <Upload
                  customRequest={handleImageUpload}
                  showUploadList={false}
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />} loading={uploadLoading}>
                    Bild hochladen (max. 5MB)
                  </Button>
                </Upload>
              )}
            </div>
          </Form.Item>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                label="Typ"
                name="typeId"
                rules={[{ required: true, message: 'Bitte wählen Sie einen Typ' }]}
              >
                <Select
                  placeholder="Typ auswählen"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={clothingTypes.map((type) => ({
                    value: type.id,
                    label: `${type.name} (${type.category})`,
                  }))}
                  onChange={handleTypeChange}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Größe"
                name="size"
                rules={[{ required: true, message: 'Bitte wählen Sie eine Größe' }]}
              >
                <Select
                  placeholder="Größe auswählen (nur eine Größe)"
                  disabled={!selectedType}
                  mode={undefined}
                  options={
                    selectedType
                      ? (() => {
                          let sizesArray: string[] = [];
                          
                          try {
                            if (Array.isArray(selectedType.availableSizes)) {
                              sizesArray = selectedType.availableSizes;
                            } else if (typeof selectedType.availableSizes === 'string') {
                              // Versuche JSON zu parsen
                              if (selectedType.availableSizes.startsWith('[') && selectedType.availableSizes.endsWith(']')) {
                                sizesArray = JSON.parse(selectedType.availableSizes);
                              } else {
                                // Fallback: Komma-getrennte Liste
                                sizesArray = selectedType.availableSizes.split(',').map(s => s.trim()).filter(s => s);
                              }
                            }
                          } catch (error) {
                            console.error('Fehler beim Parsen der Größen:', selectedType.availableSizes, error);
                            sizesArray = [];
                          }
                          
                          // Sicherstellen, dass sizesArray wirklich ein Array ist
                          if (!Array.isArray(sizesArray)) {
                            sizesArray = [];
                          }
                          
                          return sizesArray.map((size) => ({
                            value: size,
                            label: size,
                          }));
                        })()
                      : []
                  }
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Anzahl"
                name="quantity"
                rules={[{ required: true, message: 'Bitte geben Sie die Anzahl ein' }]}
                initialValue={1}
              >
                <InputNumber
                  min={1}
                  max={100}
                  style={{ width: '100%' }}
                  placeholder="Anzahl (1-100)"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Kategorie"
                name="category"
                rules={[{ required: true, message: 'Bitte wählen Sie eine Kategorie' }]}
                initialValue="POOL"
              >
                <Select
                  options={[
                    { label: 'Pool (Allgemein)', value: 'POOL' },
                    { label: 'Personalisiert', value: 'PERSONALIZED' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Zustand" name="condition" initialValue="NEW">
                <Select
                  options={CONDITION_OPTIONS}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Kaufdatum" name="purchaseDate">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Kaufpreis (€)" name="purchasePrice">
                <InputNumber
                  min={0}
                  step={0.01}
                  style={{ width: '100%' }}
                  placeholder="Pro Stück"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Erstellen
              </Button>
              <Button
                onClick={() => {
                  setIsBulkModalVisible(false);
                  bulkForm.resetFields();
                  setSelectedTypeId(null);
                  setUploadedImageUrl(null);
                }}
              >
                Abbrechen
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Kleidungsstück bearbeiten"
        open={isEditModalVisible}
        onCancel={() => {
          setIsEditModalVisible(false);
          editForm.resetFields();
          setEditingItem(null);
          setEditSelectedTypeId(null);
          setEditUploadedImageUrl(null);
        }}
        footer={null}
        width={700}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          {/* Image Upload Section */}
          <Form.Item label="Bild" name="imageUrl">
            <div>
              {editUploadedImageUrl || editForm.getFieldValue('imageUrl') ? (
                <div style={{ marginBottom: '16px' }}>
                  <Image
                    src={editUploadedImageUrl || editForm.getFieldValue('imageUrl')}
                    alt="Kleidungsstück"
                    style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }}
                  />
                  <div style={{ marginTop: '8px' }}>
                    <Button
                      danger
                      size="small"
                      onClick={handleEditRemoveImage}
                      icon={<DeleteOutlined />}
                    >
                      Bild entfernen
                    </Button>
                  </div>
                </div>
              ) : (
                <Upload
                  customRequest={handleEditImageUpload}
                  showUploadList={false}
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />} loading={editUploadLoading}>
                    Bild hochladen (max. 5MB)
                  </Button>
                </Upload>
              )}
            </div>
          </Form.Item>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                label="Typ"
                name="typeId"
                rules={[{ required: true, message: 'Bitte wählen Sie einen Typ' }]}
              >
                <Select
                  placeholder="Typ auswählen"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={clothingTypes.map((type) => ({
                    value: type.id,
                    label: `${type.name} (${type.category})`,
                  }))}
                  onChange={(value) => {
                    setEditSelectedTypeId(value);
                    editForm.setFieldsValue({ size: undefined });
                  }}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Größe"
                name="size"
                rules={[{ required: true, message: 'Bitte wählen Sie eine Größe' }]}
              >
                <Select
                  placeholder="Größe auswählen (nur eine Größe)"
                  disabled={!editSelectedTypeId}
                  mode={undefined}
                  options={
                    editSelectedTypeId
                      ? (() => {
                          const selectedEditType = clothingTypes.find((t) => t.id === editSelectedTypeId);
                          if (!selectedEditType) return [];
                          
                          let sizesArray: string[] = [];
                          
                          try {
                            if (Array.isArray(selectedEditType.availableSizes)) {
                              sizesArray = selectedEditType.availableSizes;
                            } else if (typeof selectedEditType.availableSizes === 'string') {
                              // Versuche JSON zu parsen
                              if (selectedEditType.availableSizes.startsWith('[') && selectedEditType.availableSizes.endsWith(']')) {
                                sizesArray = JSON.parse(selectedEditType.availableSizes);
                              } else {
                                // Fallback: Komma-getrennte Liste
                                sizesArray = selectedEditType.availableSizes.split(',').map(s => s.trim()).filter(s => s);
                              }
                            }
                          } catch (error) {
                            console.error('Fehler beim Parsen der Größen (Edit):', selectedEditType.availableSizes, error);
                            sizesArray = [];
                          }
                          
                          // Sicherstellen, dass sizesArray wirklich ein Array ist
                          if (!Array.isArray(sizesArray)) {
                            sizesArray = [];
                          }
                          
                          return sizesArray.map((size) => ({
                            value: size,
                            label: size,
                          }));
                        })()
                      : []
                  }
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Kategorie"
                name="category"
                rules={[{ required: true, message: 'Bitte wählen Sie eine Kategorie' }]}
              >
                <Select
                  options={[
                    { label: 'Pool (Allgemein)', value: 'POOL' },
                    { label: 'Personalisiert', value: 'PERSONALIZED' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Zustand" name="condition" rules={[{ required: true, message: 'Bitte wählen Sie einen Zustand' }]}>
                <Select
                  placeholder="Zustand auswählen"
                  options={CONDITION_OPTIONS}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Status" name="status">
                <Select
                  placeholder="Status auswählen"
                  options={[
                    { label: 'Verfügbar', value: 'AVAILABLE' },
                    { label: 'Ausgegeben', value: 'ISSUED' },
                    { label: 'In Benutzung', value: 'IN_USE' },
                    { label: 'Zurückgegeben', value: 'RETURNED' },
                    { label: 'Ausgemustert', value: 'RETIRED' },
                    { label: 'Verloren', value: 'LOST' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Kaufdatum" name="purchaseDate">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Kaufpreis (€)" name="purchasePrice">
                <InputNumber
                  min={0}
                  step={0.01}
                  style={{ width: '100%' }}
                  placeholder="Kaufpreis"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Speichern
              </Button>
              <Button
                onClick={() => {
                  setIsEditModalVisible(false);
                  editForm.resetFields();
                  setEditingItem(null);
                  setEditSelectedTypeId(null);
                  setEditUploadedImageUrl(null);
                }}
              >
                Abbrechen
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Enhanced Detail Modal */}
      <Modal
        title={`Kleidungsstück Details: ${selectedItem?.internalId || ''}`}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedItem(null);
          setItemHistory([]);
          setAuditLogs([]);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Schließen
          </Button>
        ]}
        width={1200}
      >
        {selectedItem && (
          <Spin spinning={detailLoading}>
            <Tabs
              items={[
                {
                  key: 'overview',
                  label: 'Übersicht',
                  children: (
                    <Row gutter={24}>
                      <Col span={16}>
                        <Card title="Artikel-Informationen" size="small">
                          <Descriptions column={2} bordered size="small">
                            <Descriptions.Item label="Interne ID" span={2}>
                              <strong>{selectedItem.internalId}</strong>
                            </Descriptions.Item>
                            <Descriptions.Item label="Typ">
                              {selectedItem.type.name}
                            </Descriptions.Item>
                            <Descriptions.Item label="Kategorie">
                              {selectedItem.type.category}
                            </Descriptions.Item>
                            <Descriptions.Item label="Größe">
                              {selectedItem.size}
                            </Descriptions.Item>
                            <Descriptions.Item label="Kleidungsart">
                              <Tag color={selectedItem.category === 'PERSONALIZED' ? 'purple' : 'blue'}>
                                {selectedItem.category === 'PERSONALIZED' ? 'Personalisiert' : 'Pool'}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Aktueller Besitzer" span={2}>
                              {selectedItem.currentEmployee ? (
                                <strong style={{ color: '#1890ff' }}>
                                  {selectedItem.currentEmployee.firstName} {selectedItem.currentEmployee.lastName}
                                  <span style={{ color: '#666', fontSize: '12px', marginLeft: '8px' }}>
                                    ({selectedItem.currentEmployee.email})
                                  </span>
                                </strong>
                              ) : (
                                <span style={{ color: selectedItem.status === 'ISSUED' ? '#ff4d4f' : '#999' }}>
                                  {selectedItem.status === 'ISSUED'
                                    ? '⚠️ INKONSISTENZ: Ausgegeben aber kein Besitzer zugeordnet' 
                                    : 'Nicht zugeordnet'}
                                </span>
                              )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Status">
                              <Tag color={getStatusColor(selectedItem.status)}>
                                {getStatusLabel(selectedItem.status)}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Zustand">
                              <Tag color={getConditionColor(selectedItem.condition)}>
                                {getConditionLabel(selectedItem.condition)}
                              </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Erstellt am">
                              {dayjs(selectedItem.createdAt).format('DD.MM.YYYY HH:mm')}
                            </Descriptions.Item>
                            <Descriptions.Item label="QR-Code">
                              {selectedItem.qrCode}
                            </Descriptions.Item>
                          </Descriptions>
                        </Card>

                        {(selectedItem.currentEmployee || selectedItem.personalizedFor) && (
                          <Card title="Zuordnung" size="small" style={{ marginTop: 16 }}>
                            <Descriptions column={1} bordered size="small">
                              {selectedItem.currentEmployee && (
                                <Descriptions.Item label="Aktuell bei">
                                  <strong>
                                    {selectedItem.currentEmployee.firstName} {selectedItem.currentEmployee.lastName}
                                  </strong> ({selectedItem.currentEmployee.email})
                                </Descriptions.Item>
                              )}
                              {selectedItem.personalizedFor && (
                                <Descriptions.Item label="Personalisiert für">
                                  <strong>
                                    {selectedItem.personalizedFor.firstName} {selectedItem.personalizedFor.lastName}
                                  </strong> ({selectedItem.personalizedFor.email})
                                </Descriptions.Item>
                              )}
                            </Descriptions>
                          </Card>
                        )}

                        {(selectedItem.purchaseDate || selectedItem.purchasePrice) && (
                          <Card title="Kaufinformationen" size="small" style={{ marginTop: 16 }}>
                            <Descriptions column={2} bordered size="small">
                              {selectedItem.purchaseDate && (
                                <Descriptions.Item label="Kaufdatum">
                                  {dayjs(selectedItem.purchaseDate).format('DD.MM.YYYY')}
                                </Descriptions.Item>
                              )}
                              {selectedItem.purchasePrice && (
                                <Descriptions.Item label="Kaufpreis">
                                  {selectedItem.purchasePrice.toFixed(2)} €
                                </Descriptions.Item>
                              )}
                            </Descriptions>
                          </Card>
                        )}
                      </Col>

                      <Col span={8}>
                        {selectedItem.imageUrl && (
                          <Card title="Produktbild" size="small" style={{ marginBottom: 16 }}>
                            <Image
                              src={selectedItem.imageUrl}
                              alt={selectedItem.type.name}
                              style={{ width: '100%', maxHeight: '300px', objectFit: 'contain' }}
                              preview={true}
                            />
                          </Card>
                        )}

                        <Card title="QR-Code" size="small">
                          <div style={{ textAlign: 'center' }}>
                            <QRCodeCanvas
                              value={`${window.location.origin}/clothing-items?id=${selectedItem.id}`}
                              size={200}
                              level="H"
                              includeMargin={true}
                            />
                            <p style={{ fontSize: '10px', color: '#999', marginTop: '8px' }}>
                              Scannt zu Artikel-Details
                            </p>
                          </div>
                        </Card>
                      </Col>
                    </Row>
                  ),
                },
                {
                  key: 'history',
                  label: 'Verlauf',
                  children: (
                    <Card title="Transaktions-Verlauf">
                      {itemHistory.length > 0 ? (
                        <Table
                          dataSource={[
                            // Create separate rows for issue and return events
                            ...itemHistory.flatMap(transaction => {
                              const rows = [];
                              // Issue event
                              rows.push({
                                ...transaction,
                                eventType: 'ISSUE',
                                eventDate: transaction.issuedAt,
                                eventProcessor: transaction.issuedBy,
                                key: `${transaction.id}-issue`
                              });
                              
                              // Return event (if returned)
                              if (transaction.returnedAt && transaction.returnedBy) {
                                rows.push({
                                  ...transaction,
                                  eventType: 'RETURN',
                                  eventDate: transaction.returnedAt,
                                  eventProcessor: transaction.returnedBy,
                                  key: `${transaction.id}-return`
                                });
                              }
                              
                              return rows;
                            })
                          ].sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())}
                          columns={[
                            {
                              title: 'Datum',
                              dataIndex: 'eventDate',
                              key: 'date',
                              render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm'),
                            },
                            {
                              title: 'Aktion',
                              dataIndex: 'eventType',
                              key: 'type',
                              render: (eventType: string) => (
                                <Tag color={eventType === 'ISSUE' ? 'green' : 'orange'}>
                                  {eventType === 'ISSUE' ? 'Ausgabe' : 'Rückgabe'}
                                </Tag>
                              ),
                            },
                            {
                              title: 'Mitarbeiter',
                              key: 'employee',
                              render: (record: any) => 
                                `${record.employee.firstName} ${record.employee.lastName}`,
                            },
                            {
                              title: 'Bearbeitet von',
                              key: 'processedBy',
                              render: (record: any) => {
                                const processor = record.eventProcessor;
                                return processor ? 
                                  `${processor.firstName} ${processor.lastName}` : 
                                  'N/A';
                              },
                            },
                            {
                              title: 'Zustand',
                              key: 'condition',
                              render: (record: any) => {
                                const condition = record.eventType === 'ISSUE' ? 
                                  record.conditionOnIssue : 
                                  record.conditionOnReturn;
                                
                                if (!condition) return 'N/A';
                                
                                return (
                                  <Tag color={getConditionColor(condition)}>
                                    {getConditionLabel(condition)}
                                  </Tag>
                                );
                              },
                            },
                            {
                              title: 'Protokoll',
                              key: 'protocol',
                              render: (record: any) => {
                                // Show button for issue protocols (always available after confirmation)
                                if (record.eventType === 'ISSUE') {
                                  return (
                                    <Button
                                      type="primary"
                                      size="small"
                                      icon={<DownloadOutlined />}
                                      onClick={() => downloadProtocol(record.id, 'issue')}
                                    >
                                      Ausgabe
                                    </Button>
                                  );
                                }
                                
                                // Show button for return protocols (only if actually returned)
                                if (record.eventType === 'RETURN' && record.returnedAt) {
                                  return (
                                    <Button
                                      type="primary" 
                                      size="small"
                                      icon={<DownloadOutlined />}
                                      onClick={() => downloadProtocol(record.id, 'return')}
                                    >
                                      Rücknahme
                                    </Button>
                                  );
                                }
                                
                                return null;
                              },
                            },
                          ]}
                          pagination={false}
                          size="small"
                        />
                      ) : (
                        <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                          Keine Transaktionen vorhanden
                        </p>
                      )}
                    </Card>
                  ),
                },
                {
                  key: 'protocols',
                  label: 'Protokolle',
                  children: (
                    <Card title="Verfügbare Protokolle">
                      {itemHistory.length > 0 ? (
                        <Table
                          dataSource={itemHistory.flatMap(transaction => {
                            const protocols = [];
                            
                            // Issue protocol
                            protocols.push({
                              key: `${transaction.id}-issue`,
                              transactionId: transaction.id,
                              type: 'issue',
                              date: transaction.issuedAt,
                              employee: `${transaction.employee.firstName} ${transaction.employee.lastName}`,
                              processor: transaction.issuedBy?.name || 'Unbekannt',
                              title: 'Ausgabeprotokoll',
                              available: true, // Issue protocols are available after confirmation
                            });
                            
                            // Return protocol (if returned)
                            if (transaction.returnedAt) {
                              protocols.push({
                                key: `${transaction.id}-return`,
                                transactionId: transaction.id,
                                type: 'return',
                                date: transaction.returnedAt,
                                employee: `${transaction.employee.firstName} ${transaction.employee.lastName}`,
                                processor: transaction.returnedBy?.name || 'Unbekannt',
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
                              render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm'),
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
                              title: 'Mitarbeiter',
                              dataIndex: 'employee',
                              key: 'employee',
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
                      ) : (
                        <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                          Keine Transaktionen vorhanden - keine Protokolle verfügbar
                        </p>
                      )}
                    </Card>
                  ),
                },
                {
                  key: 'audit',
                  label: 'Änderungsprotokoll',
                  children: (
                    <Card title="Änderungshistorie">
                      {auditLogs.length > 0 ? (
                        <Table
                          dataSource={auditLogs}
                          rowKey="id"
                          columns={[
                            {
                              title: 'Datum/Zeit',
                              dataIndex: 'timestamp',
                              key: 'timestamp',
                              render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm:ss'),
                              width: 150,
                            },
                            {
                              title: 'Aktion',
                              dataIndex: 'action',
                              key: 'action',
                              render: (action: string) => {
                                const actionLabels = {
                                  'CREATE': 'Erstellt',
                                  'UPDATE': 'Geändert', 
                                  'RETIRE': 'Ausgemustert',
                                  'DELETE': 'Gelöscht'
                                };
                                return (
                                  <Tag color={action === 'CREATE' ? 'green' : action === 'DELETE' || action === 'RETIRE' ? 'red' : 'blue'}>
                                    {actionLabels[action as keyof typeof actionLabels] || action}
                                  </Tag>
                                );
                              },
                              width: 100,
                            },
                            {
                              title: 'Bearbeiter',
                              dataIndex: 'performedBy',
                              key: 'performedBy',
                              render: (user: any) => {
                                if (user?.firstName && user?.lastName) {
                                  return `${user.firstName} ${user.lastName}`;
                                } else if (user?.firstName) {
                                  return user.firstName;
                                } else if (user?.lastName) {
                                  return user.lastName;
                                } else {
                                  return 'System';
                                }
                              },
                              width: 150,
                            },
                            {
                              title: 'Änderungen',
                              dataIndex: 'changes',
                              key: 'changes',
                              render: (changes: any) => {
                                let parsedChanges = changes;
                                
                                // Parse JSON string if needed
                                if (typeof changes === 'string') {
                                  try {
                                    parsedChanges = JSON.parse(changes);
                                  } catch (e) {
                                    return <span style={{ color: '#999' }}>Ungültiges Format</span>;
                                  }
                                }
                                
                                if (!parsedChanges || Object.keys(parsedChanges).length === 0) {
                                  return <span style={{ color: '#999' }}>Keine Details verfügbar</span>;
                                }

                                // Handle old format with before/after/input structure
                                if (parsedChanges.before && parsedChanges.after) {
                                  const beforeObj = parsedChanges.before;
                                  const afterObj = parsedChanges.after;
                                  
                                  return (
                                    <div style={{ maxWidth: '300px' }}>
                                      {Object.keys(beforeObj).map((field) => {
                                        const fieldLabels = {
                                          'condition': 'Zustand',
                                          'status': 'Status',
                                          'size': 'Größe',
                                          'category': 'Kategorie',
                                          'purchasePrice': 'Kaufpreis',
                                          'purchaseDate': 'Kaufdatum',
                                          'imageUrl': 'Produktbild'
                                        };

                                        const fieldName = fieldLabels[field as keyof typeof fieldLabels] || field;
                                        const oldValue = beforeObj[field] || 'leer';
                                        const newValue = afterObj[field] || 'leer';
                                        
                                        // Only show if values are different
                                        if (oldValue !== newValue) {
                                          return (
                                            <div key={field} style={{ marginBottom: '4px', fontSize: '12px' }}>
                                              <strong>{fieldName}:</strong>
                                              <br />
                                              <span style={{ color: '#ff4d4f' }}>{String(oldValue)}</span> 
                                              {' → '}
                                              <span style={{ color: '#52c41a' }}>{String(newValue)}</span>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                                  );
                                }

                                // Handle new format with field: {old, new} structure
                                return (
                                  <div style={{ maxWidth: '300px' }}>
                                    {Object.entries(parsedChanges).map(([field, change]: [string, any]) => {
                                      const fieldLabels = {
                                        'condition': 'Zustand',
                                        'status': 'Status',
                                        'size': 'Größe',
                                        'category': 'Kategorie',
                                        'purchasePrice': 'Kaufpreis',
                                        'purchaseDate': 'Kaufdatum',
                                        'imageUrl': 'Produktbild',
                                        'personalizedForId': 'Personalisiert für',
                                        'currentEmployeeId': 'Aktueller Mitarbeiter',
                                        'retirementDate': 'Ausmusterungsdatum',
                                        'retirementReason': 'Ausmusterungsgrund',
                                        'internalId': 'Interne ID',
                                        'type': 'Typ'
                                      };

                                      const fieldName = fieldLabels[field as keyof typeof fieldLabels] || field;
                                      
                                      // Check if it's a simple value (for CREATE action) or old/new structure (for UPDATE)
                                      if (typeof change === 'object' && change !== null && change.old !== undefined && change.new !== undefined) {
                                        const oldValue = change.old || 'leer';
                                        const newValue = change.new || 'leer';
                                        
                                        return (
                                          <div key={field} style={{ marginBottom: '4px', fontSize: '12px' }}>
                                            <strong>{fieldName}:</strong>
                                            <br />
                                            <span style={{ color: '#ff4d4f' }}>{String(oldValue)}</span> 
                                            {' → '}
                                            <span style={{ color: '#52c41a' }}>{String(newValue)}</span>
                                          </div>
                                        );
                                      } else {
                                        // For CREATE action - just show the value
                                        return (
                                          <div key={field} style={{ marginBottom: '4px', fontSize: '12px' }}>
                                            <strong>{fieldName}:</strong> {String(change)}
                                          </div>
                                        );
                                      }
                                    })}
                                  </div>
                                );
                              },
                            },
                          ]}
                          pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) => `${range[0]}-${range[1]} von ${total} Einträgen`,
                          }}
                          size="small"
                        />
                      ) : (
                        <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                          <p>🕐 Keine Änderungen protokolliert</p>
                          <p style={{ fontSize: '12px', marginTop: '10px' }}>
                            {selectedItem ? (
                              <>
                                <strong>Debug-Info:</strong><br />
                                Artikel-ID: {selectedItem.id}<br />
                                Audit-Logs geladen: {auditLogs === null ? 'Nicht versucht' : auditLogs.length + ' Einträge'}<br />
                                Status: Das Audit-System ist möglicherweise noch nicht aktiviert oder<br />
                                es wurden noch keine Änderungen an diesem Artikel vorgenommen.
                              </>
                            ) : 'Keine Artikel-Daten verfügbar'}
                          </p>
                          <p style={{ fontSize: '11px', color: '#ccc', marginTop: '10px' }}>
                            Hinweis: Öffnen Sie die Browser-Konsole (F12) für weitere Details.
                          </p>
                        </div>
                      )}
                    </Card>
                  ),
                },
              ]}
            />
          </Spin>
        )}
      </Modal>
    </div>
  );
};

export default ClothingItemsPage;
