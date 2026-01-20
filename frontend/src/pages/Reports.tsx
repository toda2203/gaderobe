import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, message, Typography, Alert } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { apiClient } from '@services/api';
import { useAuthStore } from '@store/authStore';

const { Title } = Typography;

interface DatabaseStats {
  employees: number;
  clothingTypes: number;
  clothingItems: number;
  transactions: number;
  auditLogs: number;
  totalRecords: number;
}

export default function Reports() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user?.id]);

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

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <DatabaseOutlined /> Reports
      </Title>
      <Alert
        message="Datenbank-Statistiken"
        description="Übersicht über die wichtigsten Kennzahlen."
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
    </div>
  );
}
