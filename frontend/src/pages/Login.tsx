import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Spin, Button, Typography, Space } from 'antd';
import { LoginOutlined } from '@ant-design/icons';
import { useAuthStore } from '@store/authStore';
import { authService } from '@services/authService';

const { Title, Paragraph } = Typography;

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth, setLoading, isAuthenticated, isLoading } = useAuthStore();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const appName = 'Garderobe';
    const appLogo = '/assets/kreis.png';

  // Load logo saved in settings
  useEffect(() => {
    const savedLogo = localStorage.getItem('company_logo');
    if (savedLogo) {
      setLogoUrl(savedLogo);
    }
  }, []);

  // Check if authenticated and navigate
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    console.log('Login useEffect - code:', code, 'isLoading:', isLoading);
    if (code && !isLoading) {
      handleCallback(code);
    }
  }, [searchParams]);

  const handleCallback = async (code: string) => {
    setLoading(true);
    try {
      const result = await authService.handleCallback(code);
      setAuth(result.user as any, result.token, result.refreshToken);
      setLoading(false);
    } catch (error) {
      console.error('Login failed:', error);
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const authUrl = await authService.getLoginUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to get login URL:', error);
      setLoading(false);
    }
  };

  const code = searchParams.get('code');

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
                 Berufsbekleidungsverwaltung mit Microsoft-Login.
              </Paragraph>
            </div>
          </Space>

          {code ? (
            <div style={{ textAlign: 'center', color: '#ffffff' }}>
              <Spin size="large" />
              <Paragraph style={{ marginTop: 16, color: 'rgba(255, 255, 255, 0.85)' }}>
                Anmeldung wird verarbeitet...
              </Paragraph>
            </div>
          ) : (
            <div className="auth-actions">
              <Button
                type="primary"
                size="large"
                icon={<LoginOutlined />}
                onClick={handleLogin}
                block
              >
                Mit Microsoft anmelden
              </Button>
              <Paragraph style={{ marginTop: 12, textAlign: 'center', color: 'rgba(255, 255, 255, 0.65)' }}>
                Nutzen Sie Ihr bestehendes Firmenkonto für den sicheren Login.
              </Paragraph>
            </div>
          )}
        </Space>
      </Card>
    </div>
  );
}
