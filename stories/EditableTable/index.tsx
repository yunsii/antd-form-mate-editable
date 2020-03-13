import React, { useState, useEffect } from 'react';
import { Button, Divider } from 'antd';
import moment from 'moment';
import EditableTable, { IntlProvider, enUSIntl } from '../../src';

const genderOptions = [
  {
    label: '男',
    value: 1,
  },
  {
    label: '女',
    value: 2,
  },
];

export default () => {
  const [
    editingKey,
    setEditingKey,
  ] = useState<string | null>();
  const mockData = [
    {
      id: 1,
      gender: 1,
      name: 'xys',
      birthday: null,
    },
    {
      id: 2,
      gender: 2,
      name: 'theprimone',
      birthday: null,
    },
  ];
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setData(mockData)
    }, 500);
  }, []);

  return (
    <IntlProvider value={enUSIntl}>
      <div style={{ width: '100%', height: '100%', padding: 48 }}>
        <div style={{ width: 900, margin: '0 auto' }}>
          <Button
            onClick={() => {
              setData([{
                id: data.length + 1,
                name: "xxx",
                gender: 1
              }, ...data]);
              setEditingKey(`${data.length + 1}`);
            }}
            type="primary"
            style={{
              margin: "12px 0",
            }}
          >
            Create
          </Button>
          <EditableTable
            rowKey="id"
            isExistedRecord={(record) => {
              if (!record.id) { return false }

              for (const item of mockData) {
                if (item.id === record.id) {
                  return true;
                }
              }
              return false;
            }}
            columns={[
              {
                title: '姓名',
                dataIndex: 'name',
                editConfig: {
                  type: 'string',
                },
              },
              {
                title: '性别',
                dataIndex: 'gender',
                editConfig: {
                  type: 'select',
                  componentProps: {
                    options: genderOptions,
                  },
                },
              },
              {
                title: '生日',
                dataIndex: 'birthday',
                render: (value) => {
                  if (value) {
                    return moment(value).format('YYYY-MM-DD');
                  }
                  return '-';
                },
                editConfig: {
                  type: 'date',
                  formItemProps: {
                    required: true,
                  }
                },
              },
            ]}
            data={data}
            onCreate={async (record) => {
              console.log('create record', record);
            }}
            onUpdate={async (record) => {
              console.log('update record', record);
            }}
            onDelete={async (record) => {
              console.log('delete record', record);
            }}
            onChange={(data) => {
              console.log(data);
              setData(data);
            }}
            onCancel={(prevRecord, record) => {
              console.log(prevRecord, record);
            }}
            editingKey={editingKey}
            setEditingKey={(key) => setEditingKey(key)}
          />
          <Divider />
          <Button
            type='primary'
            onClick={() => alert(`editingKey: ${editingKey}`)}
          >
            Alert editingKey
          </Button>
        </div>
      </div>
    </IntlProvider>
  )
}
