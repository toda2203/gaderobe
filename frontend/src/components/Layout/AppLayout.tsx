import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Typography, Space, Tooltip, Image } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  ShoppingOutlined,
  SwapOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@store/authStore';
import { authService } from '@services/authService';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const appIcon = '/assets/transparent.png';

  // Load logo from localStorage
  useEffect(() => {
    const savedLogo = localStorage.getItem('company_logo');
    setLogoUrl(savedLogo);
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  // Filter menu items based on user role
  const getMenuItems = () => {
    const allMenuItems = [
      {
        key: '/',
        icon: <DashboardOutlined />,
        label: (
          <Tooltip title="Übersicht mit Statistiken und aktuellen Aktivitäten" placement="right">
            Dashboard
          </Tooltip>
        ),
      },
      {
        key: '/employees',
        icon: <TeamOutlined />,
        label: (
          <Tooltip title="Mitarbeiterverwaltung - Anzeigen, Bearbeiten, Ausblenden" placement="right">
            Mitarbeiter
          </Tooltip>
        ),
      },
      {
        key: '/clothing-types',
        icon: <ShoppingOutlined />,
        label: (
          <Tooltip title="Kleidungstypen - Definitionen/Vorlagen (z.B. 'Sicherheitsschuhe S3')" placement="right">
            Kleidungstypen
          </Tooltip>
        ),
      },
      {
        key: '/clothing',
        icon: <ShoppingOutlined />,
        label: (
          <Tooltip title="Kleidungsstücke - Einzelne physische Artikel mit QR-Codes" placement="right">
            Kleidungsstücke
          </Tooltip>
        ),
      },
      {
        key: '/transactions',
        icon: <SwapOutlined />,
        label: (
          <Tooltip title="Ausgabe und Rücknahme von Kleidung an/von Mitarbeitern" placement="right">
            Übergaben
          </Tooltip>
        ),
      },
      {
        key: '/reports',
        icon: <BarChartOutlined />,
        label: (
          <Tooltip title="Berichte und Auswertungen exportieren" placement="right">
            Auswertungen
          </Tooltip>
        ),
      },
      {
        key: '/settings',
        icon: <SettingOutlined />,
        label: (
          <Tooltip title="Stammdaten, Entra ID Sync und Systemeinstellungen" placement="right">
            Einstellungen
          </Tooltip>
        ),
      },
      {
        key: '/audit-log',
        icon: <AuditOutlined />,
        label: (
          <Tooltip title="Audit Log - Änderungshistorie und Systemereignisse" placement="right">
            Audit Log
          </Tooltip>
        ),
        hidden: user?.role !== 'ADMIN', // Only for ADMIN
      },
    ];

    // For READ_ONLY users, only show Dashboard, Clothing Items (their own), and Transactions (their own)
    if (user?.role === 'READ_ONLY') {
      return allMenuItems.filter(item => 
        item.key === '/' || 
        item.key === '/clothing' || 
        item.key === '/transactions'
      );
    }

    return allMenuItems.filter(item => !item.hidden);
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profil',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Abmelden',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={250}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'white',
            fontSize: collapsed ? 16 : 18,
            fontWeight: 'bold',
            padding: '0 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image
              src={appIcon}
              alt="Garderobe"
              style={{
                width: collapsed ? '32px' : '40px',
                height: collapsed ? '32px' : '40px',
                objectFit: 'contain'
              }}
              preview={false}
            />
            {!collapsed && (
              <>
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Firmenlogo"
                    style={{
                      maxHeight: '40px',
                      maxWidth: '120px',
                      objectFit: 'contain'
                    }}
                    preview={false}
                  />
                ) : (
                  <span style={{ fontSize: '18px' }}>Garderobe</span>
                )}
              </>
            )}
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={getMenuItems()}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 32px',
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            borderBottom: '1px solid #f0f0f0',
            height: '64px'
          }}
        >
          <Dropdown 
            menu={{ items: userMenuItems }} 
            placement="bottomRight"
            trigger={['click']}
          >
            <div 
              style={{ 
                cursor: 'pointer', 
                padding: '8px 16px', 
                borderRadius: '8px', 
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Avatar 
                size={40}
                style={{ 
                  backgroundColor: '#1677ff',
                  boxShadow: '0 2px 8px rgba(22, 119, 255, 0.2)',
                  border: '2px solid #fff'
                }} 
                icon={<UserOutlined />} 
              />
              {!collapsed && (
                <div style={{ lineHeight: '1.2' }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 500, 
                    color: '#262626',
                    marginBottom: '2px'
                  }}>
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#8c8c8c',
                    fontWeight: 400
                  }}>
                    {user?.department || 'Mitarbeiter'}
                  </div>
                </div>
              )}
            </div>
          </Dropdown>
        </Header>

        <Content style={{ margin: '24px', background: '#f0f2f5' }}>
          <div style={{ padding: 24, background: '#fff', borderRadius: 8, minHeight: 'calc(100vh - 160px)' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
