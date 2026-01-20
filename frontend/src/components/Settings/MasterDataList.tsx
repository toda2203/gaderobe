import React, { useState, useEffect, ReactNode } from 'react';
import { Card, Button, Input, Space, message, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, DragOutlined } from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProps } from 'react-beautiful-dnd';
import api from '@services/api';

// Workaround for React 18 Strict Mode + react-beautiful-dnd
const StrictModeDroppable = React.forwardRef<HTMLDivElement, DroppableProps & { children: (provided: any, snapshot: any) => ReactNode }>(
  ({ children, ...props }, ref) => {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
      const animation = requestAnimationFrame(() => setEnabled(true));
      return () => {
        cancelAnimationFrame(animation);
        setEnabled(false);
      };
    }, []);

    if (!enabled) return null;
    return <Droppable {...props}>{children}</Droppable>;
  }
);

interface MasterDataListProps {
  title: string;
  type: 'SIZE' | 'CATEGORY' | 'DEPARTMENT';
  canEdit: boolean;
}

export const MasterDataList: React.FC<MasterDataListProps> = ({ title, type, canEdit }) => {
  const [items, setItems] = useState<Array<{ id: string; value: string; order: number; type: string }>>([]);
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadItems();
  }, [type]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/public/master-data/${type}`);
      const loadedItems = response.data?.data || [];
      setItems(loadedItems);
      if (loadedItems.length === 0) {
        console.warn(`No items found for type ${type}`);
      }
    } catch (error) {
      console.error('Error loading items:', error);
      message.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newValue.trim()) {
      message.warning('Bitte geben Sie einen Wert ein');
      return;
    }

    try {
      setAdding(true);
      const response = await api.post(`/system/master-data/${type}`, {
        value: newValue.trim(),
      });
      setItems(response.data?.data || []);
      setNewValue('');
      message.success('Erfolgreich hinzugefügt');
    } catch (error: any) {
      console.error('Error adding item:', error);
      message.error(error.response?.data?.error || 'Fehler beim Hinzufügen');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (value: string) => {
    try {
      const response = await api.delete(`/system/master-data/${type}/${encodeURIComponent(value)}`);
      setItems(response.data?.data || []);
      message.success('Erfolgreich gelöscht');
    } catch (error: any) {
      console.error('Error deleting item:', error);
      message.error(error.response?.data?.error || 'Fehler beim Löschen');
    }
  };;

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;
    if (source.index === destination.index) return;

    const newItems = Array.from(items);
    const [movedItem] = newItems.splice(source.index, 1);
    newItems.splice(destination.index, 0, movedItem);
    setItems(newItems);

    try {
      await api.put(`/system/master-data/${type}/reorder`, {
        items: newItems,
      });
      message.success('Reihenfolge gespeichert');
    } catch (error: any) {
      console.error('Error reordering:', error);
      message.error('Fehler beim Speichern der Reihenfolge');
      loadItems();
    }
  };

  return (
    <Card
      title={title}
      extra={
        canEdit && (
          <Space size="small">
            <Input
              placeholder="Neuer Eintrag"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onPressEnter={handleAdd}
              style={{ width: 150 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} loading={adding}>
              Hinzufügen
            </Button>
          </Space>
        )
      }
    >
      <Spin spinning={loading}>
        {canEdit && items.length > 0 && (
          <div style={{ marginBottom: 12, color: '#666', fontSize: 12 }}>
            💡 Ziehen Sie Einträge um die Reihenfolge zu ändern
          </div>
        )}

        <DragDropContext onDragEnd={handleDragEnd}>
          <StrictModeDroppable droppableId={`${type}-list`}>
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                style={{
                  backgroundColor: snapshot.isDraggingOver ? '#f0f5ff' : 'transparent',
                  borderRadius: 4,
                  transition: 'background-color 0.2s',
                }}
              >
                {items.length === 0 ? (
                  <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>
                    Keine Einträge vorhanden
                  </div>
                ) : (
                  items.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!canEdit}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 12px',
                            marginBottom: 4,
                            backgroundColor: snapshot.isDragging ? '#fff7e6' : '#fafafa',
                            border: '1px solid #d9d9d9',
                            borderRadius: 4,
                            transition: 'all 0.2s',
                            ...provided.draggableProps.style,
                          }}
                        >
                          {canEdit && (
                            <div
                              {...provided.dragHandleProps}
                              style={{ cursor: 'grab', marginRight: 8, color: '#999' }}
                            >
                              <DragOutlined />
                            </div>
                          )}
                          <span style={{ flex: 1 }}>{item.value}</span>
                          {canEdit && (
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => handleDelete(item.value)}
                            />
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </div>
            )}
          </StrictModeDroppable>
        </DragDropContext>
      </Spin>
    </Card>
  );
};
