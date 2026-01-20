import React, { useEffect, useState, useCallback } from 'react';
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
  InputNumber,
  Upload,
  Image,
} from 'antd';
import type { UploadProps } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const { TextArea } = Input;

interface ClothingType {
  id: string;
  name: string;
  description: string | null;
  category: string;
  availableSizes: string[];
  expectedLifespanMonths: number | null;
  requiresDepartment: string[] | null;
  imageUrl: string | null;
  isActive: boolean;
  itemCount?: number;
  availableCount?: number;
  createdAt: string;
}

interface ClothingTypeStats {
  total: number;
  active: number;
  inactive: number;
  byCategory: Array<{ category: string; count: number }>;
  totalItems: number;
  availableItems: number;
}

const ClothingTypesPage: React.FC = () => {
  const { message } = App.useApp();
  const [clothingTypes, setClothingTypes] = useState<ClothingType[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<ClothingType[]>([]);
  const [stats, setStats] = useState<ClothingTypeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [searchText, setSearchText] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string[]>([]);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const { user } = useAuthStore();
  const canEdit = Boolean(user && user.role !== 'READ_ONLY');
  const isAdmin = user?.role === 'ADMIN';

  // Load categories, sizes, departments from API (fallback to previous localStorage/defaults)
  const loadMasterData = useCallback(async () => {
    const defaults = {
      categories: [
        'Schuhe',
        'Oberbekleidung',
        'Unterbekleidung',
        'Schutzbekleidung',
        'Accessoires',
        'Sonstiges',
      ],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50'],
      departments: ['Verkauf', 'Werkstatt', 'Verwaltung', 'Lager'],
    };

    try {
      const [catRes, sizeRes, deptRes] = await Promise.all([
        api.get('/public/master-data/CATEGORY'),
        api.get('/public/master-data/SIZE'),
        api.get('/public/master-data/DEPARTMENT'),
      ]);

      // Extract values from API response objects {id, value, order, type}
      const extractValue = (item: any) => {
        return typeof item === 'string' ? item : item.value;
      };

      const catValues = (catRes.data?.data || defaults.categories).map((c: any) => {
        const val = extractValue(c);
        return { label: val, value: val };
      });
      const sizeValues = (sizeRes.data?.data || defaults.sizes).map((s: any) => {
        const val = extractValue(s);
        return { label: val, value: val };
      });
      const deptValues = (deptRes.data?.data || defaults.departments).map((d: any) => {
        const val = extractValue(d);
        return { label: val, value: val };
      });

      setCategories(catValues);
      setAvailableSizes(sizeValues);
      setDepartments(deptValues);

      // persist in localStorage for offline/fallback use
      localStorage.setItem('clothing_categories', JSON.stringify(catValues.map((c) => c.value)));
      localStorage.setItem('clothing_sizes', JSON.stringify(sizeValues.map((s) => s.value)));
      localStorage.setItem('departments', JSON.stringify(deptValues.map((d) => d.value)));
    } catch (error) {
      console.error('Master data load failed, falling back to local/defaults', error);
      const storedCategories = localStorage.getItem('clothing_categories');
      const storedSizes = localStorage.getItem('clothing_sizes');
      const storedDepartments = localStorage.getItem('departments');

      const extractValue = (item: any) => {
        return typeof item === 'string' ? item : item.value;
      };

      setCategories(
        (storedCategories ? JSON.parse(storedCategories) : defaults.categories).map((c: any) => ({
          label: extractValue(c),
          value: extractValue(c),
        }))
      );

      setAvailableSizes(
        (storedSizes ? JSON.parse(storedSizes) : defaults.sizes).map((s: any) => ({
          label: extractValue(s),
          value: extractValue(s),
        }))
      );

      setDepartments(
        (storedDepartments ? JSON.parse(storedDepartments) : defaults.departments).map((d: any) => ({
          label: extractValue(d),
          value: extractValue(d),
        }))
      );
    }
  }, []); // useCallback dependencies

  const [categories, setCategories] = useState<Array<{ label: string; value: string }>>([]);
  const [availableSizes, setAvailableSizes] = useState<Array<{ label: string; value: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Refresh sizes/categories when modal opens to pick up new settings values
  useEffect(() => {
    if (isModalVisible) {
      loadMasterData();
    }
  }, [isModalVisible, loadMasterData]);

  // Fetch clothing types and stats
  const fetchData = async () => {
    try {
      setLoading(true);
      const [typesRes, statsRes] = await Promise.all([
        api.get('/clothing-types', {
          params: { isActive: !showInactive ? true : undefined },
        }),
        api.get('/clothing-types/stats'),
      ]);

      setClothingTypes(typesRes.data.data);
      setStats(statsRes.data.data);
    } catch (error) {
      message.error('Fehler beim Laden der Kleidungstypen');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  // Apply filters
  useEffect(() => {
    let filtered = clothingTypes;

    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (type) =>
          type.name.toLowerCase().includes(search) ||
          type.description?.toLowerCase().includes(search)
      );
    }

    if (filterCategory.length > 0) {
      filtered = filtered.filter((type) => filterCategory.includes(type.category));
    }

    if (filterActive !== undefined) {
      filtered = filtered.filter((type) => type.isActive === filterActive);
    }

    setFilteredTypes(filtered);
  }, [clothingTypes, searchText, filterCategory, filterActive]);

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
      form.setFieldsValue({ imageUrl });
      
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

  // Handle remove uploaded image
  const handleRemoveImage = async () => {
    const currentImageUrl = form.getFieldValue('imageUrl') || uploadedImageUrl;
    
    if (currentImageUrl) {
      try {
        await api.delete('/clothing/items/delete-image', {
          data: { imageUrl: currentImageUrl },
        });
        setUploadedImageUrl(null);
        form.setFieldsValue({ imageUrl: null });
        message.success('Bild entfernt');
      } catch (error) {
        console.error('Error removing image:', error);
      }
    } else {
      setUploadedImageUrl(null);
      form.setFieldsValue({ imageUrl: null });
    }
  };

  // Handle create/edit
  const handleSave = async (values: any) => {
    try {
      console.log('ClothingType form values:', values); // Debug logging
      
      if (editingId) {
        // Update
        await api.patch(`/clothing-types/${editingId}`, values);
        message.success('Kleidungstyp aktualisiert');
      } else {
        // Create
        await api.post('/clothing-types', values);
        message.success('Kleidungstyp erstellt');
      }

      setIsModalVisible(false);
      form.resetFields();
      setEditingId(null);
      fetchData();
    } catch (error: any) {
      console.error('ClothingType save error:', error); // Debug logging
      message.error(
        error.response?.data?.error || 'Fehler beim Speichern des Kleidungstyps'
      );
    }
  };

  // Handle edit
  const handleEdit = (clothingType: ClothingType) => {
    // Parse availableSizes from string to array if needed
    let parsedSizes = clothingType.availableSizes;
    if (typeof clothingType.availableSizes === 'string') {
      try {
        parsedSizes = JSON.parse(clothingType.availableSizes);
      } catch (error) {
        console.error('Fehler beim Parsen der verfügbaren Größen:', error);
        parsedSizes = [];
      }
    }
    
    // Parse requiresDepartment from string to array if needed
    let parsedDepartments = clothingType.requiresDepartment;
    if (typeof clothingType.requiresDepartment === 'string') {
      try {
        parsedDepartments = JSON.parse(clothingType.requiresDepartment);
      } catch (error) {
        console.error('Fehler beim Parsen der erforderlichen Abteilungen:', error);
        parsedDepartments = null;
      }
    }

    form.setFieldsValue({
      name: clothingType.name,
      description: clothingType.description,
      category: clothingType.category,
      availableSizes: parsedSizes,
      expectedLifespanMonths: clothingType.expectedLifespanMonths,
      requiresDepartment: parsedDepartments,
      imageUrl: clothingType.imageUrl,
    });
    setUploadedImageUrl(clothingType.imageUrl);
    setEditingId(clothingType.id);
    setIsModalVisible(true);
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/clothing-types/${id}`);
      message.success('Kleidungstyp deaktiviert');
      fetchData();
    } catch (error) {
      message.error('Fehler beim Löschen des Kleidungstyps');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      await api.delete(`/clothing-types/${id}/permanent`);
      message.success('Kleidungstyp dauerhaft gelöscht');
      fetchData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Fehler beim dauerhaften Löschen';
      message.error(errorMsg);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingId(null);
    setUploadedImageUrl(null);
  };

  const columns = [
    {
      title: 'Bild',
      key: 'image',
      width: 80,
      render: (_: any, record: ClothingType) =>
        record.imageUrl ? (
          <Image
            src={record.imageUrl}
            alt={record.name}
            width={50}
            height={50}
            style={{ objectFit: 'cover', borderRadius: '4px' }}
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
        ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: ClothingType, b: ClothingType) => a.name.localeCompare(b.name),
    },
    {
      title: 'Kategorie',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: 'Größen',
      dataIndex: 'availableSizes',
      key: 'availableSizes',
      render: (sizes: string[] | string) => {
        if (!sizes) return <span>0 Größen</span>;
        
        // Robuste Konvertierung zu Array
        let sizesArray: string[] = [];
        
        try {
          if (Array.isArray(sizes)) {
            sizesArray = sizes;
          } else if (typeof sizes === 'string') {
            // Versuche JSON zu parsen
            if (sizes.startsWith('[') && sizes.endsWith(']')) {
              sizesArray = JSON.parse(sizes);
            } else {
              // Fallback: Komma-getrennte Liste
              sizesArray = sizes.split(',').map(s => s.trim()).filter(s => s);
            }
          } else {
            // Fallback für andere Datentypen
            sizesArray = [];
          }
        } catch (error) {
          console.error('Fehler beim Parsen der Größen:', sizes, error);
          sizesArray = [];
        }
        
        // Sicherstellen, dass sizesArray wirklich ein Array ist
        if (!Array.isArray(sizesArray)) {
          sizesArray = [];
        }
        
        return (
          <span>{sizesArray.length} Größen: {sizesArray.slice(0, 3).join(', ')}{sizesArray.length > 3 ? '...' : ''}</span>
        );
      },
    },
    {
      title: 'Lebensdauer',
      dataIndex: 'expectedLifespanMonths',
      key: 'expectedLifespanMonths',
      render: (months: number | null) => months ? `${months} Monate` : '-',
    },
    {
      title: 'Artikel',
      key: 'items',
      render: (_: any, record: ClothingType) => (
        <span>
          {record.itemCount || 0} gesamt, {record.availableCount || 0} verfügbar
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? 'Aktiv' : 'Inaktiv'}
        </Tag>
      ),
    },
    {
      title: 'Aktion',
      key: 'action',
      render: (_: any, record: ClothingType) => (
        <Space size="middle">
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
              <Popconfirm
                title="Kleidungstyp deaktivieren?"
                description="Sind Sie sicher?"
                onConfirm={() => handleDelete(record.id)}
                okText="Ja"
                cancelText="Nein"
              >
                <Button danger size="small" icon={<DeleteOutlined />}>
                  Löschen
                </Button>
              </Popconfirm>
              {isAdmin && !record.isActive && (
                <Popconfirm
                  title="Dauerhaft löschen?"
                  description="Diese Aktion kann nicht rückgängig gemacht werden! Typ muss ohne verknüpfte Artikel sein."
                  onConfirm={() => handlePermanentDelete(record.id)}
                  okText="Ja, löschen"
                  cancelText="Abbrechen"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger type="primary" size="small" icon={<DeleteOutlined />}>
                    Endgültig löschen
                  </Button>
                </Popconfirm>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1>Kleidungstypen</h1>
      </div>

      <Card size="small" style={{ marginBottom: '16px', background: '#fafafa', borderColor: '#e5e7eb' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 500, color: '#1f2937' }}>
          Schritt 1: Kleidungstypen definieren
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
          Legen Sie hier die Grundtypen Ihrer Kleidungsstücke an – z. B. „Arbeitshandschuhe", „Sicherheitsweste", „Berufsjacke". 
          Für jeden Typ definieren Sie: Beschreibung, Kategorie (z. B. Oberbekleidung), verfügbare Größen (XS, S, M, L, XL), Lebensdauer und optionales Bild. 
          Diese Vorlagen werden dann genutzt, um einzelne Kleidungsartikel zu erzeugen – z. B. mehrere Arbeitshandschuhe in Größe M oder L.
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
                title="Aktiv"
                value={stats.active}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Artikel gesamt" value={stats.totalItems} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Verfügbare Artikel"
                value={stats.availableItems}
                valueStyle={{ color: '#52c41a' }}
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
                form.resetFields();
                setEditingId(null);
                setUploadedImageUrl(null);
                setIsModalVisible(true);
              }}
            >
              Neuer Kleidungstyp
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchData}
            loading={loading}
          >
            Aktualisieren
          </Button>
          {canEdit && (
            <Switch
              checked={showInactive}
              onChange={setShowInactive}
              checkedChildren="Inaktive anzeigen"
              unCheckedChildren="Inaktive ausblenden"
            />
          )}
        </Space>
      </div>

      {/* Search and Filter */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Input.Search
              placeholder="Suche (Name, Beschreibung)"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              mode="multiple"
              placeholder="Nach Kategorie filtern"
              value={filterCategory}
              onChange={(value) => setFilterCategory(value || [])}
              allowClear
              style={{ width: '100%' }}
              maxTagCount={2}
              maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
              options={categories}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Nach Status filtern"
              value={filterActive !== undefined ? (filterActive ? 'active' : 'inactive') : undefined}
              onChange={(value) => {
                if (value === 'active') setFilterActive(true);
                else if (value === 'inactive') setFilterActive(false);
                else setFilterActive(undefined);
              }}
              allowClear
              options={[
                { label: 'Aktiv', value: 'active' },
                { label: 'Inaktiv', value: 'inactive' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button
              onClick={() => {
                setSearchText('');
                setFilterCategory([]);
                setFilterActive(undefined);
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
          dataSource={filteredTypes}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />
      </Spin>

      {/* Modal */}
      <Modal
        title={editingId ? 'Kleidungstyp bearbeiten' : 'Neuer Kleidungstyp'}
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={handleModalClose}
        okText="Speichern"
        cancelText="Abbrechen"
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Name ist erforderlich' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item label="Beschreibung" name="description">
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item
            label="Kategorie"
            name="category"
            rules={[{ required: true, message: 'Kategorie ist erforderlich' }]}
          >
            <Select placeholder="Wählen Sie eine Kategorie" options={categories} />
          </Form.Item>

          <Form.Item
            label="Verfügbare Größen"
            name="availableSizes"
            rules={[
              { required: true, message: 'Größen sind erforderlich' },
            ]}
          >
            <Select
              mode="multiple"
              placeholder="Wählen Sie Größen"
              options={availableSizes}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '16px' }}>
            <Space size="small">
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: '12px' }}
                onClick={() => {
                  loadMasterData(); // Reload sizes from localStorage
                  message.success('Größen aktualisiert');
                }}
              >
                🔄 Aktualisieren
              </Button>
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: '12px' }}
                onClick={() => {
                  // Open settings in new tab/window to manage sizes
                  window.open('/settings#stammdaten', '_blank');
                }}
              >
                📝 Größen in Stammdaten verwalten
              </Button>
            </Space>
          </div>

          <Form.Item
            label="Erwartete Lebensdauer (Monate)"
            name="expectedLifespanMonths"
          >
            <InputNumber min={1} max={120} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Erforderlich für Abteilungen"
            name="requiresDepartment"
          >
            <Select
              mode="multiple"
              placeholder="Optional: Abteilungen auswählen"
              options={departments}
              allowClear
            />
          </Form.Item>

          <Form.Item label="Bild" name="imageUrl">
            <div>
              {uploadedImageUrl || form.getFieldValue('imageUrl') ? (
                <div style={{ marginBottom: '16px' }}>
                  <Image
                    src={uploadedImageUrl || form.getFieldValue('imageUrl')}
                    alt="Kleidungstyp"
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

          {editingId && (
            <Form.Item
              label="Status"
              name="isActive"
              valuePropName="checked"
              initialValue={true}
            >
              <Switch checkedChildren="Aktiv" unCheckedChildren="Inaktiv" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default ClothingTypesPage;
