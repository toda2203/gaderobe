
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography, Space, Input, Button, message } from 'antd';
import { LoginOutlined } from '@ant-design/icons';
import { useAuthStore } from '@store/authStore';
import { authService } from '@services/authService';

const { Title, Paragraph } = Typography;

export default function Login() {
  const navigate = useNavigate();
  const { setAuth, setLoading, isAuthenticated, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLocalLoading] = useState(false);
  const appName = 'Garderobe';
  const appLogo = '/assets/garderobe.png';

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/');
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleLogin = async () => {
    setLocalLoading(true);
    setLoading(true);
    try {
      const result = await authService.localLogin(email, password);
      setAuth(result.user as any, result.token, result.refreshToken);
      setLocalLoading(false);
      setLoading(false);
      message.success('Login erfolgreich!');
      navigate('/');
    } catch (error: any) {
      setLocalLoading(false);
      setLoading(false);
      message.error(error?.response?.data?.error?.message || 'Login fehlgeschlagen');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-blob blob-one" />
      <div className="auth-blob blob-two" />

      <Card className="auth-card" bodyStyle={{ padding: 32 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div className="auth-badge">BITTE ANMELDEN</div>

          <Space align="center" size="large" style={{ width: '100%' }}>
            <div className="auth-logo">
              <img src={appLogo} alt="Garderobe Logo" />
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <Title level={2} style={{ margin: 0, color: '#ffffff' }}>{appName}</Title>
              <Paragraph style={{ margin: '6px 0 0', color: 'rgba(255, 255, 255, 0.75)' }}>
                 Berufsbekleidungsverwaltung – Lokaler Login
              </Paragraph>
            </div>
          </Space>

          <div className="auth-actions">
            <Input
              placeholder="E-Mail"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              size="large"
              autoFocus
              disabled={loading}
            />
            <Input.Password
              placeholder="Passwort"
              value={password}
              onChange={e => setPassword(e.target.value)}
              size="large"
              disabled={loading}
              onPressEnter={handleLogin}
            />
            <Button
              type="primary"
              size="large"
              icon={<LoginOutlined />}
              onClick={handleLogin}
              block
              loading={loading}
              disabled={!email || !password || loading}
              style={{ marginTop: 12 }}
            >
              Anmelden
            </Button>
          </div>
        </Space>
      </Card>
    </div>
  );
}
