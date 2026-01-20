import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Select,
  Input,
  Tabs,
  Tag,
  Space,
  Descriptions,
  Statistic,
  Row,
  Col,
  App,
  Typography,
} from 'antd';
import {
  SwapOutlined,
  RollbackOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const { TextArea } = Input;
const { Text } = Typography;

// Condition options constant - used everywhere for consistency
const CONDITION_OPTIONS = [
  { label: 'Neu', value: 'NEW' },
  { label: 'Gut', value: 'GOOD' },
  { label: 'Abgenutzt', value: 'WORN' },
  { label: 'Ausgemustert', value: 'RETIRED' },
];

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  status: string;
}

interface ClothingType {
  id: string;
  name: string;
  category: string;
}

interface ClothingItem {
  id: string;
  internalId: string;
  qrCode: string;
  type: ClothingType;
  size: string;
  category: string;
  status: string;
  condition: string;
}

interface Transaction {
  id: string;
  employee: Employee;
  clothingItem: ClothingItem;
  type: string;
  issuedAt: string;
  returnedAt: string | null;
  conditionOnIssue: string;
  conditionOnReturn: string | null;
  issuedBy: Employee;
  returnedBy: Employee | null;
  notes: string | null;
}

interface TransactionStats {
  totalTransactions: number;
  activeIssues: number;
  returnedItems: number;
  avgDaysUntilReturn: number;
}

const Transactions: React.FC = () => {
  const { user } = useAuthStore();
  const token = useAuthStore((state) => state.token);
  const { message } = App.useApp();

  // Search and filter state
  const [searchText, setSearchText] = useState<string>('');
  const [filterEmployee, setFilterEmployee] = useState<string[]>([]);
  const [filteredPendingReturns, setFilteredPendingReturns] = useState<Transaction[]>([]);
  const [filteredPendingIssues, setFilteredPendingIssues] = useState<Transaction[]>([]);

  // Bulk issue state
  const [bulkIssueModalVisible, setBulkIssueModalVisible] = useState(false);
  const [bulkForm] = Form.useForm();
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingReturns, setPendingReturns] = useState<Transaction[]>([]);
  const [pendingIssues, setPendingIssues] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clothingTypes, setClothingTypes] = useState<ClothingType[]>([]);
  const [availableItems, setAvailableItems] = useState<ClothingItem[]>([]);
  const [filteredAvailableItems, setFilteredAvailableItems] = useState<ClothingItem[]>([]);

  // Filter states for bulk return list
  const [returnSearchText, setReturnSearchText] = useState<string>('');
  const [returnFilterType, setReturnFilterType] = useState<string[]>([]);
  const [returnFilterCondition, setReturnFilterCondition] = useState<string[]>([]);
  const [returnFilterCategory, setReturnFilterCategory] = useState<string[]>([]);
  const [returnFilterSize, setReturnFilterSize] = useState<string[]>([]);
  const [filteredReturnItems, setFilteredReturnItems] = useState<Transaction[]>([]);
  
  // Filter states for available items in issue modal
  const [itemSearchText, setItemSearchText] = useState<string>('');
  const [itemFilterType, setItemFilterType] = useState<string[]>([]);
  const [itemFilterCondition, setItemFilterCondition] = useState<string[]>([]);
  const [itemFilterCategory, setItemFilterCategory] = useState<string[]>([]);
  const [itemFilterSize, setItemFilterSize] = useState<string[]>([]);

  // Detail modal state
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [clothingItemHistory, setClothingItemHistory] = useState<Transaction[]>([]);

  // Bulk return state
  const [bulkReturnModalVisible, setBulkReturnModalVisible] = useState(false);
  const [bulkReturnForm] = Form.useForm();
  const [selectedReturnTransactionIds, setSelectedReturnTransactionIds] = useState<string[]>([]);
  const [selectedEmployeeForReturn, setSelectedEmployeeForReturn] = useState<string | null>(null);

  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedReturnTransaction, setSelectedReturnTransaction] = useState<Transaction | null>(null);

  const [returnForm] = Form.useForm();

  const canEdit = ['ADMIN', 'WAREHOUSE', 'HR'].includes(user?.role || '');

  useEffect(() => {
    fetchData();
  }, []);

  // Apply filters for pending returns
  useEffect(() => {
    let filtered = pendingReturns;

    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (trans) =>
          trans.employee.firstName.toLowerCase().includes(search) ||
          trans.employee.lastName.toLowerCase().includes(search) ||
          trans.clothingItem.internalId.toLowerCase().includes(search) ||
          trans.clothingItem.type.name.toLowerCase().includes(search)
      );
    }

    if (filterEmployee.length > 0) {
      filtered = filtered.filter((trans) => filterEmployee.includes(trans.employee.id));
    }

    setFilteredPendingReturns(filtered);
  }, [pendingReturns, searchText, filterEmployee]);

  // Apply filters for pending issues
  useEffect(() => {
    let filtered = pendingIssues;

    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (trans) =>
          trans.employee.firstName.toLowerCase().includes(search) ||
          trans.employee.lastName.toLowerCase().includes(search) ||
          trans.clothingItem.internalId.toLowerCase().includes(search) ||
          trans.clothingItem.type.name.toLowerCase().includes(search)
      );
    }

    if (filterEmployee.length > 0) {
      filtered = filtered.filter((trans) => filterEmployee.includes(trans.employee.id));
    }

    setFilteredPendingIssues(filtered);
  }, [pendingIssues, searchText, filterEmployee]);

  // Apply filters for available items in issue modal
  useEffect(() => {
    let filtered = availableItems;

    // Search filter
    if (itemSearchText.trim()) {
      const search = itemSearchText.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.internalId.toLowerCase().includes(search) ||
          item.type.name.toLowerCase().includes(search) ||
          item.size.toLowerCase().includes(search)
      );
    }

    // Type filter
    if (itemFilterType.length > 0) {
      filtered = filtered.filter((item) => itemFilterType.includes(item.type.id));
    }

    // Condition filter
    if (itemFilterCondition.length > 0) {
      filtered = filtered.filter((item) => conditionMatchesFilter(item.condition, itemFilterCondition));
    }

    // Category filter
    if (itemFilterCategory.length > 0) {
      filtered = filtered.filter((item) => itemFilterCategory.includes(item.category));
    }

    // Size filter
    if (itemFilterSize.length > 0) {
      filtered = filtered.filter((item) => itemFilterSize.includes(item.size));
    }

    setFilteredAvailableItems(filtered);
  }, [availableItems, itemSearchText, itemFilterType, itemFilterCondition, itemFilterCategory, itemFilterSize]);

  // Apply filters for bulk return list
  useEffect(() => {
    if (!selectedEmployeeForReturn) {
      setFilteredReturnItems([]);
      return;
    }

    let filtered = pendingReturns.filter((t) => t.employee.id === selectedEmployeeForReturn);

    if (returnSearchText.trim()) {
      const search = returnSearchText.toLowerCase();
      filtered = filtered.filter((t) =>
        t.clothingItem.internalId.toLowerCase().includes(search) ||
        t.clothingItem.type.name.toLowerCase().includes(search) ||
        (t.clothingItem.size || '').toLowerCase().includes(search)
      );
    }

    if (returnFilterType.length > 0) {
      filtered = filtered.filter((t) => returnFilterType.includes(t.clothingItem.type.id));
    }

    if (returnFilterCondition.length > 0) {
      filtered = filtered.filter((t) => conditionMatchesFilter(t.conditionOnIssue, returnFilterCondition));
    }

    if (returnFilterCategory.length > 0) {
      filtered = filtered.filter((t) => returnFilterCategory.includes(t.clothingItem.category));
    }

    if (returnFilterSize.length > 0) {
      filtered = filtered.filter((t) => returnFilterSize.includes(t.clothingItem.size));
    }

    setFilteredReturnItems(filtered);
  }, [pendingReturns, selectedEmployeeForReturn, returnSearchText, returnFilterType, returnFilterCondition, returnFilterCategory, returnFilterSize]);

  // Pre-fill condition for selected return items (falls User nicht expandiert)
  useEffect(() => {
    if (!selectedReturnTransactionIds.length) return;
    const values = bulkReturnForm.getFieldsValue();
    const patch: Record<string, any> = {};

    selectedReturnTransactionIds.forEach((id) => {
      const key = `condition_${id}`;
      if (!values[key]) {
        const tx = pendingReturns.find((t) => t.id === id);
        if (tx) {
          patch[key] = tx.conditionOnIssue;
        }
      }
    });

    if (Object.keys(patch).length > 0) {
      bulkReturnForm.setFieldsValue(patch);
    }
  }, [selectedReturnTransactionIds, pendingReturns, bulkReturnForm]);

  // Auto-populate condition when items are selected
  useEffect(() => {
    if (selectedItemIds.length > 0 && availableItems.length > 0) {
      const selectedItems = availableItems.filter(item => selectedItemIds.includes(item.id));
      
      if (selectedItems.length > 0) {
        // Check if all selected items have the same condition
        const conditions = selectedItems.map(item => item.condition);
        const uniqueConditions = [...new Set(conditions)];
        
        if (uniqueConditions.length === 1) {
          // All items have the same condition, auto-populate
          bulkForm.setFieldValue('conditionOnIssue', uniqueConditions[0]);
        } else {
          // Different conditions, use the most common one or clear field
          const conditionCounts = conditions.reduce((acc, condition) => {
            acc[condition] = (acc[condition] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          const mostCommonCondition = Object.entries(conditionCounts)
            .sort(([,a], [,b]) => b - a)[0][0];
          
          bulkForm.setFieldValue('conditionOnIssue', mostCommonCondition);
        }
      }
    } else {
      // Clear condition when no items selected
      bulkForm.setFieldValue('conditionOnIssue', undefined);
    }
  }, [selectedItemIds, availableItems, bulkForm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTransactions(),
        fetchPendingReturns(),
        fetchPendingIssues(),
        fetchStats(),
        fetchEmployees(),
        fetchAvailableItems(),
        fetchClothingTypes(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      message.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchPendingReturns = async () => {
    try {
      const response = await fetch('/api/transactions/pending', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingReturns(data.data);
      }
    } catch (error) {
      console.error('Error fetching pending returns:', error);
    }
  };

  const fetchPendingIssues = async () => {
    try {
      const response = await fetch('/api/transactions/pending-issues', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingIssues(data.data);
      }
    } catch (error) {
      console.error('Error fetching pending issues:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/transactions/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees?includeHidden=false', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.data.filter((e: Employee) => e.status === 'ACTIVE'));
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchAvailableItems = async () => {
    try {
      const response = await fetch('/api/clothing/items?status=AVAILABLE', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableItems(data.data);
      }
    } catch (error) {
      console.error('Error fetching available items:', error);
    }
  };

  const fetchClothingTypes = async () => {
    try {
      const response = await fetch('/api/clothing-types?isActive=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setClothingTypes(data.data);
      }
    } catch (error) {
      console.error('Error fetching clothing types:', error);
    }
  };

  const handleBulkIssue = async (values: any) => {
    if (selectedItemIds.length === 0) {
      message.warning('Bitte wählen Sie mindestens einen Artikel aus');
      return;
    }

    // Ensure conditionOnIssue is set
    let conditionOnIssue = values.conditionOnIssue;
    if (!conditionOnIssue && selectedItemIds.length > 0) {
      // Fallback: use condition from first selected item
      const firstSelectedItem = availableItems.find(item => selectedItemIds.includes(item.id));
      conditionOnIssue = firstSelectedItem?.condition || 'GOOD';
    }

    try {
      const response = await api.post('/transactions/bulk-issue', {
        ...values,
        conditionOnIssue,
        clothingItemIds: selectedItemIds,
      });

      if (response.data.success) {
        message.success(response.data.message || `${selectedItemIds.length} Artikel erfolgreich ausgegeben`);
        
        // Automatisch PDF-Protokoll herunterladen (skip confirmation check for fresh issue)
        const transactionIds = response.data.data.map((t: any) => t.id).join(',');
        await downloadBulkProtocol(transactionIds, true);
        
        setBulkIssueModalVisible(false);
        bulkForm.resetFields();
        setSelectedItemIds([]);
        fetchData();
      }
    } catch (error: any) {
      console.error('Error bulk issuing clothing:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Fehler bei der Bulk-Ausgabe';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler bei der Bulk-Ausgabe');
    }
  };

  const handleReturnClothing = async (values: any) => {
    if (!selectedReturnTransaction) return;

    try {
      const response = await api.post(`/transactions/${selectedReturnTransaction.id}/return`, values);

      if (response.data.success) {
        message.success('Kleidung erfolgreich zurückgenommen');
        setReturnModalVisible(false);
        setSelectedReturnTransaction(null);
        returnForm.resetFields();
        fetchData();
      }
    } catch (error: any) {
      console.error('Error returning clothing:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Fehler beim Zurücknehmen der Kleidung';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Zurücknehmen der Kleidung');
    }
  };

  const handleBulkReturn = async (values: any) => {
    if (selectedReturnTransactionIds.length === 0) {
      message.warning('Bitte wählen Sie mindestens einen Artikel aus');
      return;
    }

    try {
      // Map for quick lookup
      const txMap = new Map(pendingReturns.map((t) => [t.id, t]));

      // Create individual return data for each selected item
      const returnData = selectedReturnTransactionIds.map(transactionId => {
        const condition = values[`condition_${transactionId}`] || txMap.get(transactionId)?.conditionOnIssue;
        const itemNotes = values[`notes_${transactionId}`];
        
        if (!condition) {
          throw new Error(`Zustand für Artikel ${transactionId} nicht definiert`);
        }
        
        return {
          transactionId,
          conditionOnReturn: condition,
          notes: itemNotes || undefined // Only include notes if they exist
        };
      });

      const response = await api.post('/transactions/bulk-return-individual', {
        items: returnData,
        generalNotes: values.generalNotes
      });

      if (response.data.success) {
        message.success(response.data.message || `${selectedReturnTransactionIds.length} Artikel erfolgreich zurückgenommen`);
        
        // Automatisch PDF-Protokoll herunterladen
        const transactionIds = response.data.data.map((t: any) => t.id).join(',');
        await downloadBulkReturnProtocol(transactionIds);
        
        setBulkReturnModalVisible(false);
        bulkReturnForm.resetFields();
        setSelectedReturnTransactionIds([]);
        setSelectedEmployeeForReturn(null);
        fetchData();
      }
    } catch (error: any) {
      console.error('Error bulk returning clothing:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Fehler bei der Bulk-Rücknahme';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler bei der Bulk-Rücknahme');
    }
  };

  const openReturnModal = (transaction: Transaction) => {
    setSelectedReturnTransaction(transaction);
    setReturnModalVisible(true);
  };

  const handleResendConfirmation = async (transactionId: string) => {
    try {
      setLoading(true);
      const response = await api.post(`/confirmations/resend/${transactionId}`);
      
      if (response.data.success) {
        message.success('Bestätigungs-E-Mail wurde erneut gesendet');
      } else {
        message.error('Fehler beim Senden der Bestätigungs-E-Mail');
      }
    } catch (error: any) {
      console.error('Error resending confirmation:', error);
      const errorMsg = error.response?.data?.error || 'Fehler beim Senden der Bestätigungs-E-Mail';
      message.error(typeof errorMsg === 'string' ? errorMsg : 'Fehler beim Senden der Bestätigungs-E-Mail');
    } finally {
      setLoading(false);
    }
  };

  const handleRowDoubleClick = async (transaction: Transaction) => {
    try {
      setSelectedTransaction(transaction);
      setDetailModalVisible(true);
      setLoading(true);

      // Fetch complete history for this clothing item
      const response = await api.get(`/transactions/history/${transaction.clothingItem.id}`);
      if (response.data.success) {
        setClothingItemHistory(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching clothing item history:', error);
      message.error('Fehler beim Laden der Kleidungsstück-Historie');
    } finally {
      setLoading(false);
    }
  };

  const downloadProtocol = async (transactionId: string, type: 'issue' | 'return') => {
    try {
      const response = await fetch(
        `/api/reports/transaction/${transactionId}/protocol?type=${type}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type === 'issue' ? 'Ausgabe' : 'Ruecknahme'}-${transactionId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        message.success('Protokoll heruntergeladen');
      } else {
        message.error('Fehler beim Herunterladen des Protokolls');
      }
    } catch (error) {
      console.error('Error downloading protocol:', error);
      message.error('Fehler beim Herunterladen des Protokolls');
    }
  };

  const downloadBulkProtocol = async (transactionIds: string, skipConfirmationCheck = false) => {
    try {
      const queryParam = skipConfirmationCheck ? `&skipConfirmationCheck=true` : '';
      const response = await fetch(
        `/api/reports/bulk-issue?transactionIds=${transactionIds}${queryParam}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ausgabeprotokoll-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        message.success('Ausgabeprotokoll heruntergeladen');
      } else {
        message.error('Fehler beim Herunterladen des Protokolls');
      }
    } catch (error) {
      console.error('Error downloading bulk protocol:', error);
      message.error('Fehler beim Herunterladen des Protokolls');
    }
  };

  const downloadBulkReturnProtocol = async (transactionIds: string) => {
    try {
      const response = await fetch(
        `/api/reports/bulk-return?transactionIds=${transactionIds}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ruecknahmeprotokoll-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        message.success('Rücknahmeprotokoll heruntergeladen');
      } else {
        message.error('Fehler beim Herunterladen des Protokolls');
      }
    } catch (error) {
      console.error('Error downloading bulk return protocol:', error);
      message.error('Fehler beim Herunterladen des Protokolls');
    }
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

  // Map legacy condition values to current ones for filtering
  const normalizeCondition = (condition: string) => {
    const mapping: Record<string, string> = {
      ACCEPTABLE: 'WORN',
      DAMAGED: 'RETIRED',
    };
    return mapping[condition] || condition;
  };

  // Check if a condition matches filter (accounting for legacy values)
  const conditionMatchesFilter = (condition: string, filterValues: string[]) => {
    const normalized = normalizeCondition(condition);
    return filterValues.includes(normalized) || filterValues.includes(condition);
  };

  const pendingColumns = [
    {
      title: 'Mitarbeiter',
      key: 'employee',
      render: (record: Transaction) => `${record.employee.firstName} ${record.employee.lastName}`,
    },
    {
      title: 'Abteilung',
      dataIndex: ['employee', 'department'],
      key: 'department',
    },
    {
      title: 'Artikel',
      key: 'item',
      render: (record: Transaction) => (
        <div>
          <div>{record.clothingItem.type.name}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {record.clothingItem.internalId} | Größe: {record.clothingItem.size}
          </div>
        </div>
      ),
    },
    {
      title: 'Ausgegeben am',
      dataIndex: 'issuedAt',
      key: 'issuedAt',
      render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Zustand',
      dataIndex: 'conditionOnIssue',
      key: 'conditionOnIssue',
      render: (condition: string) => (
        <Tag color={getConditionColor(condition)}>
          {getConditionLabel(condition)}
        </Tag>
      ),
    },
  ];

  const pendingIssuesColumns = [
    {
      title: 'Mitarbeiter',
      key: 'employee',
      render: (record: Transaction) => `${record.employee.firstName} ${record.employee.lastName}`,
    },
    {
      title: 'E-Mail',
      dataIndex: ['employee', 'email'],
      key: 'email',
    },
    {
      title: 'Artikel',
      key: 'item',
      render: (record: Transaction) => (
        <div>
          <div>{record.clothingItem.type.name}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {record.clothingItem.internalId} | Größe: {record.clothingItem.size}
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: Transaction) => (
        <Tag color="orange" icon={<ClockCircleOutlined />}>
          Ausstehend
        </Tag>
      ),
    },
    {
      title: 'Ausgegeben am',
      dataIndex: 'issuedAt',
      key: 'issuedAt',
      render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Aktion',
      key: 'action',
      render: (record: Transaction) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleResendConfirmation(record.id)}
        >
          E-Mail erneut senden
        </Button>
      ),
    },
  ];

  const historyEventColumns = [
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
      render: (record: any) => `${record.employee.firstName} ${record.employee.lastName}`,
    },
    {
      title: 'Artikel',
      key: 'item',
      render: (record: any) => (
        <div>
          <div>{record.clothingItem.type.name}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>{record.clothingItem.internalId}</div>
        </div>
      ),
    },
    {
      title: 'Größe',
      key: 'size',
      render: (record: any) => record.clothingItem.size,
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
      title: 'Status',
      key: 'status',
      render: (record: any) => {
        if (record.eventType === 'RETURN') {
          return <Tag color="default">Zurückgegeben</Tag>;
        }
        return record.returnedAt ? 
          <Tag color="warning">Zurückgegeben</Tag> :
          <Tag color="green">Aktiv</Tag>;
      },
    },
  ];

  const historyColumns = [
    {
      title: 'Mitarbeiter',
      key: 'employee',
      render: (record: Transaction) => `${record.employee.firstName} ${record.employee.lastName}`,
    },
    {
      title: 'Artikel',
      key: 'item',
      render: (record: Transaction) => (
        <div>
          <div>{record.clothingItem.type.name}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>{record.clothingItem.internalId}</div>
        </div>
      ),
    },
    {
      title: 'Ausgegeben',
      dataIndex: 'issuedAt',
      key: 'issuedAt',
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
    {
      title: 'Zurückgegeben',
      dataIndex: 'returnedAt',
      key: 'returnedAt',
      render: (date: string | null) =>
        date ? (
          <Tag color="green">{dayjs(date).format('DD.MM.YYYY')}</Tag>
        ) : (
          <Tag color="orange">Ausstehend</Tag>
        ),
    },
    {
      title: 'Zustand',
      key: 'condition',
      render: (record: Transaction) => (
        <Space>
          <Tag color={getConditionColor(record.conditionOnIssue)}>
            Aus: {getConditionLabel(record.conditionOnIssue)}
          </Tag>
          {record.conditionOnReturn && (
            <Tag color={getConditionColor(record.conditionOnReturn)}>
              Zurück: {getConditionLabel(record.conditionOnReturn)}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Ausgegeben von',
      key: 'issuedBy',
      render: (record: Transaction) =>
        record.issuedBy
          ? `${record.issuedBy.firstName} ${record.issuedBy.lastName}`
          : 'System',
    },
    {
      title: 'Protokolle',
      key: 'protocols',
      render: (record: Transaction) => (
        <Space>
          {/* Ausgabe-PDF nur verfügbar wenn Status ISSUED ist (bestätigt) */}
          {record.clothingItem.status === 'ISSUED' ? (
            <Button
              size="small"
              icon={<FilePdfOutlined />}
              onClick={() => downloadProtocol(record.id, 'issue')}
            >
              Ausgabe
            </Button>
          ) : (
            <Button
              size="small"
              icon={<ClockCircleOutlined />}
              disabled
              title="Ausgabe-PDF verfügbar nach Bestätigung"
            >
              Ausstehend
            </Button>
          )}
          {record.returnedAt && (
            <Button
              size="small"
              icon={<FilePdfOutlined />}
              onClick={() => downloadProtocol(record.id, 'return')}
            >
              Rücknahme
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1>Transaktionen</h1>

      {stats && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Gesamt Transaktionen"
                value={stats.totalTransactions}
                prefix={<SwapOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Aktiv ausgegeben"
                value={stats.activeIssues}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Zurückgegeben"
                value={stats.returnedItems}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Ø Tage bis Rückgabe"
                value={stats.avgDaysUntilReturn}
                suffix="Tage"
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Tabs
          defaultActiveKey="pending"
          tabBarExtraContent={
            canEdit && (
              <Space>
                <Button
                  type="primary"
                  icon={<SwapOutlined />}
                  onClick={() => setBulkIssueModalVisible(true)}
                >
                  Kleidung ausgeben
                </Button>
                <Button
                  icon={<RollbackOutlined />}
                  onClick={() => setBulkReturnModalVisible(true)}
                >
                  Kleidung zurücknehmen
                </Button>
              </Space>
            )
          }
          items={[
            {
              key: 'pending',
              label: 'im Umlauf',
              children: (
                <>
                  <Card style={{ marginBottom: '16px' }}>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12} md={8}>
                        <Input.Search
                          placeholder="Suche (Mitarbeiter, Artikel, ID)"
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          allowClear
                        />
                      </Col>
                      <Col xs={24} sm={12} md={8}>
                        <Select
                          mode="multiple"
                          placeholder="Nach Mitarbeiter filtern"
                          value={filterEmployee}
                          onChange={(value) => setFilterEmployee(value || [])}
                          allowClear
                          showSearch
                          style={{ width: '100%' }}
                          maxTagCount={1}
                          maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
                          optionFilterProp="label"
                          options={employees.map((emp) => ({
                            label: `${emp.firstName} ${emp.lastName}`,
                            value: emp.id,
                          }))}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={8}>
                        <Button
                          onClick={() => {
                            setSearchText('');
                            setFilterEmployee([]);
                          }}
                        >
                          Filter zurücksetzen
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                  <Table
                    columns={pendingColumns}
                    dataSource={filteredPendingReturns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    onRow={(record) => ({
                      onDoubleClick: () => handleRowDoubleClick(record),
                    })}
                  />
                </>
              ),
            },
            {
              key: 'pending-issues',
              label: (
                <span>
                  <ClockCircleOutlined />
                   Ausstehende Bestätigungen
                </span>
              ),
              children: (
                <>
                  <Card style={{ marginBottom: '16px' }}>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12} md={8}>
                        <Input.Search
                          placeholder="Suche (Mitarbeiter, Artikel, ID)"
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          allowClear
                        />
                      </Col>
                      <Col xs={24} sm={12} md={8}>
                        <Select
                          mode="multiple"
                          placeholder="Nach Mitarbeiter filtern"
                          value={filterEmployee}
                          onChange={(value) => setFilterEmployee(value || [])}
                          allowClear
                          showSearch
                          style={{ width: '100%' }}
                          maxTagCount={1}
                          maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
                          optionFilterProp="label"
                          options={employees.map((emp) => ({
                            label: `${emp.firstName} ${emp.lastName}`,
                            value: emp.id,
                          }))}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={8}>
                        <Button
                          onClick={() => {
                            setSearchText('');
                            setFilterEmployee([]);
                          }}
                        >
                          Filter zurücksetzen
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                  <Table
                    columns={pendingIssuesColumns}
                    dataSource={filteredPendingIssues}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    onRow={(record) => ({
                      onDoubleClick: () => handleRowDoubleClick(record),
                    })}
                  />
                </>
              ),
            },
            {
              key: 'history',
              label: 'Verlauf',
              children: (
                <Table
                  columns={historyEventColumns}
                  dataSource={[
                    // Create separate rows for issue and return events
                    ...transactions.flatMap(transaction => {
                      const rows = [];
                      // Issue event
                      rows.push({
                        ...transaction,
                        eventType: 'ISSUE',
                        eventDate: transaction.issuedAt,
                        eventProcessor: transaction.issuedBy,
                      });
                      
                      // Return event (if returned)
                      if (transaction.returnedAt && transaction.returnedBy) {
                        rows.push({
                          ...transaction,
                          eventType: 'RETURN',
                          eventDate: transaction.returnedAt,
                          eventProcessor: transaction.returnedBy,
                        });
                      }
                      
                      return rows;
                    })
                  ].sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())}
                  rowKey={(record: any) => `${record.id}-${record.eventType}`}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  onRow={(record) => ({
                    onDoubleClick: () => handleRowDoubleClick(record),
                  })}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Clothing Item Detail Modal */}
      <Modal
        title="Kleidungsstück Details"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedTransaction(null);
          setClothingItemHistory([]);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Schließen
          </Button>
        ]}
        width={900}
      >
        {selectedTransaction && (
          <div>
            <Card title="Kleidungsstück-Informationen" style={{ marginBottom: 16 }}>
              <Descriptions column={2} bordered>
                <Descriptions.Item label="Typ">
                  {selectedTransaction.clothingItem.type.name}
                </Descriptions.Item>
                <Descriptions.Item label="Kategorie">
                  {selectedTransaction.clothingItem.category}
                </Descriptions.Item>
                <Descriptions.Item label="Interne ID">
                  {selectedTransaction.clothingItem.internalId}
                </Descriptions.Item>
                <Descriptions.Item label="QR-Code">
                  {selectedTransaction.clothingItem.qrCode}
                </Descriptions.Item>
                <Descriptions.Item label="Größe">
                  {selectedTransaction.clothingItem.size}
                </Descriptions.Item>
                <Descriptions.Item label="Aktueller Status">
                  <Tag color={selectedTransaction.clothingItem.status === 'ISSUED' ? 'green' : 
                              selectedTransaction.clothingItem.status === 'PENDING' ? 'orange' : 'blue'}>
                    {selectedTransaction.clothingItem.status === 'ISSUED' ? 'Ausgegeben' :
                     selectedTransaction.clothingItem.status === 'PENDING' ? 'Ausstehend' : 
                     selectedTransaction.clothingItem.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Zustand">
                  <Tag color={getConditionColor(selectedTransaction.clothingItem.condition)}>
                    {getConditionLabel(selectedTransaction.clothingItem.condition)}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Aktuelle Transaktion" style={{ marginBottom: 16 }}>
              <Descriptions column={2} bordered>
                <Descriptions.Item label="Mitarbeiter">
                  {selectedTransaction.employee.firstName} {selectedTransaction.employee.lastName}
                </Descriptions.Item>
                <Descriptions.Item label="E-Mail">
                  {selectedTransaction.employee.email}
                </Descriptions.Item>
                <Descriptions.Item label="Abteilung">
                  {selectedTransaction.employee.department}
                </Descriptions.Item>
                <Descriptions.Item label="Transaktionstyp">
                  <Tag color={selectedTransaction.type === 'ISSUE' ? 'green' : 'orange'}>
                    {selectedTransaction.type === 'ISSUE' ? 'Ausgabe' : 'Rückgabe'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Ausgegeben am">
                  {dayjs(selectedTransaction.issuedAt).format('DD.MM.YYYY HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="Ausgegeben von">
                  {selectedTransaction.issuedBy.firstName} {selectedTransaction.issuedBy.lastName}
                </Descriptions.Item>
                {selectedTransaction.returnedAt && (
                  <>
                    <Descriptions.Item label="Zurückgegeben am">
                      {dayjs(selectedTransaction.returnedAt).format('DD.MM.YYYY HH:mm')}
                    </Descriptions.Item>
                    <Descriptions.Item label="Zurückgenommen von">
                      {selectedTransaction.returnedBy ? 
                        `${selectedTransaction.returnedBy.firstName} ${selectedTransaction.returnedBy.lastName}` : 
                        'N/A'}
                    </Descriptions.Item>
                  </>
                )}
                <Descriptions.Item label="Zustand bei Ausgabe">
                  <Tag color={getConditionColor(selectedTransaction.conditionOnIssue)}>
                    {getConditionLabel(selectedTransaction.conditionOnIssue)}
                  </Tag>
                </Descriptions.Item>
                {selectedTransaction.conditionOnReturn && (
                  <Descriptions.Item label="Zustand bei Rückgabe">
                    <Tag color={getConditionColor(selectedTransaction.conditionOnReturn)}>
                      {getConditionLabel(selectedTransaction.conditionOnReturn)}
                    </Tag>
                  </Descriptions.Item>
                )}
                {selectedTransaction.notes && (
                  <Descriptions.Item label="Notizen" span={2}>
                    {selectedTransaction.notes}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {clothingItemHistory.length > 0 && (
              <Card title="Verlauf dieses Kleidungsstücks">
                <Table
                  dataSource={[
                    // Create separate rows for issue and return events
                    ...clothingItemHistory.flatMap(transaction => {
                      const rows = [];
                      // Issue event
                      rows.push({
                        ...transaction,
                        eventType: 'ISSUE',
                        eventDate: transaction.issuedAt,
                        eventProcessor: transaction.issuedBy,
                      });
                      
                      // Return event (if returned)
                      if (transaction.returnedAt && transaction.returnedBy) {
                        rows.push({
                          ...transaction,
                          eventType: 'RETURN',
                          eventDate: transaction.returnedAt,
                          eventProcessor: transaction.returnedBy,
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
                        
                        const conditionLabels = {
                          'NEW': 'Neu',
                          'GOOD': 'Gut',
                          'WORN': 'Getragen',
                          'RETIRED': 'Ausgemustert'
                        };
                        
                        return conditionLabels[condition as keyof typeof conditionLabels] || condition;
                      },
                    },
                    {
                      title: 'Status',
                      key: 'status',
                      render: (record: any) => {
                        if (record.eventType === 'RETURN') {
                          return <Tag color="default">Zurückgegeben</Tag>;
                        }
                        return record.returnedAt ? 
                          <Tag color="warning">Zurückgegeben</Tag> :
                          <Tag color="green">Aktiv</Tag>;
                      },
                    },
                  ]}
                  rowKey={(record: any) => `${record.id}-${record.eventType}`}
                  pagination={false}
                  size="small"
                />
              </Card>
            )}
          </div>
        )}
      </Modal>

      {/* Issue Modal - Bulk capable */}
      <Modal
        title="Kleidung ausgeben"
        open={bulkIssueModalVisible}
        onCancel={() => {
          setBulkIssueModalVisible(false);
          bulkForm.resetFields();
          setSelectedItemIds([]);
          // Reset item filters
          setItemSearchText('');
          setItemFilterType([]);
          setItemFilterCondition([]);
          setItemFilterCategory([]);
          setItemFilterSize([]);
        }}
        footer={null}
        width={900}
      >
        <Form form={bulkForm} layout="vertical" onFinish={handleBulkIssue}>
          <Form.Item
            label="Mitarbeiter"
            name="employeeId"
            rules={[{ required: true, message: 'Bitte wählen Sie einen Mitarbeiter' }]}
          >
            <Select
              showSearch
              placeholder="Mitarbeiter auswählen"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={employees.map((emp) => ({
                value: emp.id,
                label: `${emp.firstName} ${emp.lastName} - ${emp.department}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            label={`Artikel auswählen (${selectedItemIds.length} ausgewählt)`}
            required
          >
            {/* Filter Controls */}
            <Card style={{ marginBottom: '16px' }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Input.Search
                    placeholder="Suche (ID, Typ, Größe)"
                    value={itemSearchText}
                    onChange={(e) => setItemSearchText(e.target.value)}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    mode="multiple"
                    placeholder="Nach Typ filtern"
                    value={itemFilterType}
                    onChange={(value) => setItemFilterType(value || [])}
                    allowClear
                    style={{ width: '100%' }}
                    maxTagCount={1}
                    maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
                    options={clothingTypes.map((type) => ({
                      label: type.name,
                      value: type.id,
                    }))}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    mode="multiple"
                    placeholder="Nach Zustand filtern"
                    value={itemFilterCondition}
                    onChange={(value) => setItemFilterCondition(value || [])}
                    allowClear
                    style={{ width: '100%' }}
                    maxTagCount={1}
                    maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
                    options={CONDITION_OPTIONS}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    mode="multiple"
                    placeholder="Nach Kategorie filtern"
                    value={itemFilterCategory}
                    onChange={(value) => setItemFilterCategory(value || [])}
                    allowClear
                    style={{ width: '100%' }}
                    maxTagCount={1}
                    maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
                    options={[
                      { label: 'Personalisiert', value: 'PERSONALIZED' },
                      { label: 'Pool', value: 'POOL' },
                    ]}
                  />
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Select
                    mode="multiple"
                    placeholder="Nach Größe filtern"
                    value={itemFilterSize}
                    onChange={(value) => setItemFilterSize(value || [])}
                    allowClear
                    style={{ width: '100%' }}
                    maxTagCount={1}
                    maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
                    options={
                      Array.from(new Set(availableItems.map(item => item.size)))
                        .filter(size => size)
                        .sort()
                        .map(size => ({ label: size, value: size }))
                    }
                  />
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Button
                    onClick={() => {
                      setItemSearchText('');
                      setItemFilterType([]);
                      setItemFilterCondition([]);
                      setItemFilterCategory([]);
                      setItemFilterSize([]);
                    }}
                  >
                    Filter zurücksetzen
                  </Button>
                </Col>
              </Row>
            </Card>
            
            <div style={{ 
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              height: '400px',
              overflow: 'auto'
            }}>
              <Table
                dataSource={filteredAvailableItems}
                rowKey="id"
                rowSelection={{
                  type: 'checkbox',
                  selectedRowKeys: selectedItemIds,
                  onChange: (selectedKeys) => {
                    setSelectedItemIds(selectedKeys as string[]);
                  },
                }}
                pagination={false}
                scroll={{ y: 340 }}
                size="small"
              columns={[
                {
                  title: 'Typ',
                  key: 'type',
                  render: (item: ClothingItem) => item.type.name,
                },
                {
                  title: 'Interne ID',
                  dataIndex: 'internalId',
                  key: 'internalId',
                },
                {
                  title: 'Größe',
                  dataIndex: 'size',
                  key: 'size',
                },
                {
                  title: 'Kategorie',
                  dataIndex: 'category',
                  key: 'category',
                  render: (category: string) => <Tag>{category}</Tag>,
                },
                {
                  title: 'Zustand',
                  dataIndex: 'condition',
                  key: 'condition',
                  render: (condition: string) => (
                    <Tag color={getConditionColor(condition)}>
                      {getConditionLabel(condition)}
                    </Tag>
                  ),
                },
              ]}
            />
            </div>
          </Form.Item>

          <Form.Item
            label="Zustand bei Ausgabe (wird automatisch gesetzt)"
            name="conditionOnIssue"
            tooltip="Der Zustand wird automatisch basierend auf den ausgewählten Artikeln gesetzt. Sie können ihn bei Bedarf ändern."
          >
            <Select 
              options={CONDITION_OPTIONS} 
              placeholder="Wird automatisch gesetzt basierend auf Auswahl"
              disabled={selectedItemIds.length === 0}
            />
          </Form.Item>

          <Form.Item label="Notizen" name="notes">
            <TextArea rows={2} placeholder="Optional: Notizen zur Ausgabe" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit"
                disabled={selectedItemIds.length === 0}
              >
                {selectedItemIds.length > 0 
                  ? `${selectedItemIds.length} Artikel ausgeben` 
                  : 'Artikel ausgeben'}
              </Button>
              <Button
                onClick={() => {
                  setBulkIssueModalVisible(false);
                  bulkForm.resetFields();
                  setSelectedItemIds([]);
                  // Reset item filters
                  setItemSearchText('');
                  setItemFilterType([]);
                  setItemFilterCondition([]);
                  setItemFilterCategory([]);
                }}
              >
                Abbrechen
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Return Modal */}
      <Modal
        title="Kleidung zurücknehmen (Bulk)"
        open={bulkReturnModalVisible}
        onCancel={() => {
          setBulkReturnModalVisible(false);
          bulkReturnForm.resetFields();
          setSelectedReturnTransactionIds([]);
          setSelectedEmployeeForReturn(null);
          setReturnSearchText('');
          setReturnFilterType([]);
          setReturnFilterCondition([]);
          setReturnFilterCategory([]);
          setReturnFilterSize([]);
          setFilteredReturnItems([]);
        }}
        footer={null}
        width="90%"
        style={{ maxWidth: '1400px', minWidth: '1000px' }}
        centered
        destroyOnHidden
        modalRender={(modal) => (
          <div
            style={{
              resize: 'both',
              overflow: 'auto',
              minHeight: '600px',
              maxHeight: '90vh',
            }}
          >
            {modal}
          </div>
        )}
      >
        <Form form={bulkReturnForm} layout="vertical" onFinish={handleBulkReturn}>
          <Form.Item
            label="Mitarbeiter auswählen"
            name="employeeId"
            rules={[{ required: true, message: 'Bitte wählen Sie einen Mitarbeiter' }]}
          >
            <Select
              showSearch
              placeholder="Mitarbeiter auswählen"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={employees.map((emp) => ({
                value: emp.id,
                label: `${emp.firstName} ${emp.lastName} - ${emp.department}`,
              }))}
              onChange={(value) => {
                setSelectedEmployeeForReturn(value);
                setSelectedReturnTransactionIds([]);
                setReturnSearchText('');
                setReturnFilterType([]);
                setReturnFilterCondition([]);
                setReturnFilterCategory([]);
                setReturnFilterSize([]);
              }}
            />
          </Form.Item>

          {selectedEmployeeForReturn && (
            <Form.Item
              label={`Artikel zur Rücknahme (${selectedReturnTransactionIds.length} ausgewählt)`}
              required
            >
              <Card style={{ marginBottom: '16px' }}>
                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={12} md={6}>
                    <Input.Search
                      placeholder="Suche (ID, Typ, Größe)"
                      value={returnSearchText}
                      onChange={(e) => setReturnSearchText(e.target.value)}
                      allowClear
                    />
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Select
                      mode="multiple"
                      placeholder="Nach Typ filtern"
                      value={returnFilterType}
                      onChange={(v) => setReturnFilterType(v || [])}
                      allowClear
                      style={{ width: '100%' }}
                      maxTagCount={1}
                      maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
                      options={clothingTypes.map((type) => ({ label: type.name, value: type.id }))}
                    />
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Select
                      mode="multiple"
                      placeholder="Nach Zustand (Ausgabe) filtern"
                      value={returnFilterCondition}
                      onChange={(v) => setReturnFilterCondition(v || [])}
                      allowClear
                      style={{ width: '100%' }}
                      maxTagCount={1}
                      maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
                      options={CONDITION_OPTIONS}
                    />
                  </Col>
                  <Col xs={24} sm={12} md={4}>
                    <Select
                      mode="multiple"
                      placeholder="Nach Kategorie filtern"
                      value={returnFilterCategory}
                      onChange={(v) => setReturnFilterCategory(v || [])}
                      allowClear
                      style={{ width: '100%' }}
                      maxTagCount={1}
                      maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
                      options={[
                        { label: 'Personalisiert', value: 'PERSONALIZED' },
                        { label: 'Pool', value: 'POOL' },
                      ]}
                    />
                  </Col>
                  <Col xs={24} sm={12} md={4}>
                    <Select
                      mode="multiple"
                      placeholder="Nach Größe filtern"
                      value={returnFilterSize}
                      onChange={(v) => setReturnFilterSize(v || [])}
                      allowClear
                      style={{ width: '100%' }}
                      maxTagCount={1}
                      maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} mehr`}
                      options={Array.from(new Set(
                        pendingReturns
                          .filter((t) => t.employee.id === selectedEmployeeForReturn)
                          .map((t) => t.clothingItem.size)
                      ))
                        .filter((s) => s)
                        .sort()
                        .map((s) => ({ label: s, value: s }))}
                    />
                  </Col>
                  <Col xs={24} sm={12} md={4}>
                    <Button
                      onClick={() => {
                        setReturnSearchText('');
                        setReturnFilterType([]);
                        setReturnFilterCondition([]);
                        setReturnFilterCategory([]);
                        setReturnFilterSize([]);
                      }}
                    >
                      Filter zurücksetzen
                    </Button>
                  </Col>
                </Row>
              </Card>

              <Table
                dataSource={filteredReturnItems}
                rowKey="id"
                rowSelection={{
                  type: 'checkbox',
                  selectedRowKeys: selectedReturnTransactionIds,
                  onChange: (selectedKeys) => {
                    setSelectedReturnTransactionIds(selectedKeys as string[]);
                  },
                }}
                pagination={{ pageSize: 8 }}
                scroll={{ y: 400 }}
                size="small"
                expandable={{
                  expandedRowRender: (record: Transaction) => (
                    <div style={{ padding: '16px', backgroundColor: '#fafafa' }}>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            label="Zustand bei Rücknahme"
                            name={`condition_${record.id}`}
                            rules={[{ required: selectedReturnTransactionIds.includes(record.id), message: 'Zustand erforderlich' }]}
                          >
                            <Select 
                              options={CONDITION_OPTIONS} 
                              placeholder="Zustand auswählen"
                              disabled={!selectedReturnTransactionIds.includes(record.id)}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Individuelle Notizen"
                            name={`notes_${record.id}`}
                          >
                            <TextArea 
                              rows={2} 
                              placeholder="Spezielle Notizen für diesen Artikel..."
                              disabled={!selectedReturnTransactionIds.includes(record.id)}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  ),
                  rowExpandable: (record) => selectedReturnTransactionIds.includes(record.id),
                  expandIconColumnIndex: -1,
                  expandRowByClick: true,
                }}
                columns={[
                  {
                    title: 'Typ',
                    key: 'type',
                    render: (record: Transaction) => record.clothingItem.type.name,
                  },
                  {
                    title: 'Interne ID',
                    key: 'internalId',
                    render: (record: Transaction) => record.clothingItem.internalId,
                  },
                  {
                    title: 'Größe',
                    key: 'size',
                    render: (record: Transaction) => record.clothingItem.size,
                  },
                  {
                    title: 'Ausgegeben am',
                    key: 'issuedAt',
                    render: (record: Transaction) =>
                      dayjs(record.issuedAt).format('DD.MM.YYYY'),
                  },
                  {
                    title: 'Tage ausgegeben',
                    key: 'daysOut',
                    render: (record: Transaction) => {
                      const days = dayjs().diff(dayjs(record.issuedAt), 'day');
                      return (
                        <Tag
                          color={days > 30 ? 'red' : days > 14 ? 'orange' : 'green'}
                        >
                          {days} Tage
                        </Tag>
                      );
                    },
                  },
                  {
                    title: 'Zustand bei Ausgabe',
                    key: 'conditionOnIssue',
                    render: (record: Transaction) => (
                      <Tag
                        color={getConditionColor(record.conditionOnIssue)}
                      >
                        {getConditionLabel(record.conditionOnIssue)}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Status',
                    key: 'status',
                    render: (record: Transaction) => {
                      const isSelected = selectedReturnTransactionIds.includes(record.id);
                      if (isSelected) {
                        return (
                          <Tag color="blue">
                            Bewertung erforderlich
                          </Tag>
                        );
                      }
                      return null;
                    },
                  },
                ]}
              />
              {selectedReturnTransactionIds.length > 0 && (
                <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#e6f7ff', borderRadius: '4px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    💡 Klicken Sie auf einen ausgewählten Artikel, um dessen Rückgabezustand zu bewerten
                  </Text>
                </div>
              )}
            </Form.Item>
          )}

          <Form.Item label="Allgemeine Notizen" name="generalNotes">
            <TextArea rows={2} placeholder="Allgemeine Notizen zur Rücknahme (optional)" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                disabled={selectedReturnTransactionIds.length === 0}
              >
                {selectedReturnTransactionIds.length > 0
                  ? `${selectedReturnTransactionIds.length} Artikel zurücknehmen`
                  : 'Artikel zurücknehmen'}
              </Button>
              <Button
                onClick={() => {
                  setBulkReturnModalVisible(false);
                  bulkReturnForm.resetFields();
                  setSelectedReturnTransactionIds([]);
                  setSelectedEmployeeForReturn(null);
                }}
              >
                Abbrechen
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Return Modal */}
      <Modal
        title="Kleidung zurücknehmen"
        open={returnModalVisible}
        onCancel={() => {
          setReturnModalVisible(false);
          setSelectedReturnTransaction(null);
          returnForm.resetFields();
        }}
        footer={null}
        width={800}
        centered
        destroyOnHidden
      >
        {selectedReturnTransaction && (
          <>
            <Descriptions bordered column={1} style={{ marginBottom: '24px' }}>
              <Descriptions.Item label="Mitarbeiter">
                {selectedReturnTransaction.employee.firstName} {selectedReturnTransaction.employee.lastName}
              </Descriptions.Item>
              <Descriptions.Item label="Artikel">
                {selectedReturnTransaction.clothingItem.type.name} -{' '}
                {selectedReturnTransaction.clothingItem.internalId}
              </Descriptions.Item>
              <Descriptions.Item label="Größe">
                {selectedReturnTransaction.clothingItem.size}
              </Descriptions.Item>
              <Descriptions.Item label="Ausgegeben am">
                {dayjs(selectedReturnTransaction.issuedAt).format('DD.MM.YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Zustand bei Ausgabe">
                <Tag color={getConditionColor(selectedReturnTransaction.conditionOnIssue)}>
                  {getConditionLabel(selectedReturnTransaction.conditionOnIssue)}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Form form={returnForm} layout="vertical" onFinish={handleReturnClothing}>
              <Form.Item
                label="Zustand bei Rückgabe"
                name="conditionOnReturn"
                rules={[{ required: true, message: 'Bitte wählen Sie den Zustand' }]}
              >
                <Select options={CONDITION_OPTIONS} placeholder="Zustand auswählen" />
              </Form.Item>

              <Form.Item label="Notizen" name="notes">
                <TextArea rows={3} placeholder="Optional: Notizen zur Rückgabe" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    Zurücknehmen
                  </Button>
                  <Button
                    onClick={() => {
                      setReturnModalVisible(false);
                      setSelectedTransaction(null);
                      returnForm.resetFields();
                    }}
                  >
                    Abbrechen
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default Transactions;
