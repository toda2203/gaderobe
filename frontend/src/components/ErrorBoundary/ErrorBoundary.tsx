import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Typography, Card, Collapse } from 'antd';
import { BugOutlined, ReloadOutlined, HomeOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;
const { Panel } = Collapse;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // TODO: Log to error reporting service (e.g., Sentry)
    // logErrorToService(error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = import.meta.env.DEV;

      return (
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '24px',
          background: '#f0f2f5'
        }}>
          <Card style={{ maxWidth: '800px', width: '100%' }}>
            <Result
              status="error"
              icon={<BugOutlined />}
              title="Ein Fehler ist aufgetreten"
              subTitle="Die Anwendung hat einen unerwarteten Fehler festgestellt. Bitte laden Sie die Seite neu oder kehren Sie zur Startseite zurück."
              extra={[
                <Button 
                  type="primary" 
                  icon={<ReloadOutlined />} 
                  onClick={this.handleReload}
                  key="reload"
                >
                  Seite neu laden
                </Button>,
                <Button 
                  icon={<HomeOutlined />} 
                  onClick={this.handleGoHome}
                  key="home"
                >
                  Zur Startseite
                </Button>,
              ]}
            >
              {isDevelopment && this.state.error && (
                <div style={{ textAlign: 'left', marginTop: '24px' }}>
                  <Collapse 
                    bordered={false}
                    style={{ background: '#fff' }}
                  >
                    <Panel 
                      header={
                        <Text strong>
                          <BugOutlined style={{ marginRight: '8px' }} />
                          Entwickler-Informationen
                        </Text>
                      } 
                      key="1"
                    >
                      <div style={{ marginBottom: '16px' }}>
                        <Paragraph>
                          <Text strong>Fehlermeldung:</Text>
                        </Paragraph>
                        <Paragraph 
                          code 
                          style={{ 
                            background: '#f5f5f5', 
                            padding: '12px', 
                            borderRadius: '4px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}
                        >
                          {this.state.error.toString()}
                        </Paragraph>
                      </div>

                      {this.state.errorInfo && (
                        <div>
                          <Paragraph>
                            <Text strong>Component Stack:</Text>
                          </Paragraph>
                          <Paragraph 
                            code 
                            style={{ 
                              background: '#f5f5f5', 
                              padding: '12px', 
                              borderRadius: '4px',
                              maxHeight: '300px',
                              overflow: 'auto',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontSize: '12px',
                              fontFamily: 'Monaco, Consolas, monospace'
                            }}
                          >
                            {this.state.errorInfo.componentStack}
                          </Paragraph>
                        </div>
                      )}

                      {this.state.error.stack && (
                        <div style={{ marginTop: '16px' }}>
                          <Paragraph>
                            <Text strong>Stack Trace:</Text>
                          </Paragraph>
                          <Paragraph 
                            code 
                            style={{ 
                              background: '#f5f5f5', 
                              padding: '12px', 
                              borderRadius: '4px',
                              maxHeight: '300px',
                              overflow: 'auto',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontSize: '12px',
                              fontFamily: 'Monaco, Consolas, monospace'
                            }}
                          >
                            {this.state.error.stack}
                          </Paragraph>
                        </div>
                      )}
                    </Panel>
                  </Collapse>
                </div>
              )}
            </Result>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
